use std::{
  env,
  error::Error,
  io,
  net::{TcpListener, TcpStream},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::Mutex,
  thread,
  time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

#[derive(Default)]
struct ServerState(Mutex<Option<Child>>);

fn main() {
  tauri::Builder::default()
    .manage(ServerState::default())
    .setup(|app| {
      let window_url = if cfg!(debug_assertions) {
        "http://127.0.0.1:3222".parse()?
      } else {
        start_packaged_server(&app.handle())?
      };

      WebviewWindowBuilder::new(app, "main", WebviewUrl::External(window_url))
        .title("Starchild Tauri Experimental")
        .inner_size(1440.0, 920.0)
        .min_inner_size(1100.0, 720.0)
        .resizable(true)
        .build()?;

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building Tauri application")
    .run(|app, event| {
      if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
        stop_packaged_server(app);
      }
    });
}

fn start_packaged_server(app: &AppHandle) -> Result<url::Url, Box<dyn Error>> {
  let resource_dir = app.path().resource_dir()?;
  load_runtime_env(app, &resource_dir);

  let standalone_dir = resource_dir.join("standalone");
  let server_path = resolve_standalone_server(&standalone_dir).ok_or_else(|| {
    io::Error::other(format!(
      "Standalone server not found under {}",
      standalone_dir.display()
    ))
  })?;
  let node_path = resolve_bundled_node(&resource_dir).ok_or_else(|| {
    io::Error::other(format!(
      "Bundled Node runtime not found under {}",
      resource_dir.display()
    ))
  })?;

  let server_port = reserve_loopback_port()?;
  let runtime_origin = format!("http://127.0.0.1:{server_port}");
  let mut command = Command::new(&node_path);
  command.arg(&server_path);
  command.current_dir(&standalone_dir);
  command.stdin(Stdio::null());
  command.stdout(Stdio::null());
  command.stderr(Stdio::null());
  command.env("PORT", server_port.to_string());
  command.env("HOSTNAME", "127.0.0.1");
  command.env("AUTH_URL", &runtime_origin);
  command.env("NEXTAUTH_URL", &runtime_origin);
  command.env("NEXTAUTH_URL_INTERNAL", &runtime_origin);
  command.env("NODE_ENV", "production");
  command.env("STARCHILD_DESKTOP_SHELL", "tauri");

  let node_path_entries = [
    standalone_dir.join("node_modules"),
    standalone_dir.join("node_modules").join(".pnpm").join("node_modules"),
  ]
  .into_iter()
  .filter(|candidate| candidate.exists())
  .collect::<Vec<_>>();

  if !node_path_entries.is_empty() {
    command.env("NODE_PATH", env::join_paths(node_path_entries)?);
  }

  let mut child = command.spawn()?;
  wait_for_server_ready(&mut child, server_port, Duration::from_secs(30))?;

  let state = app.state::<ServerState>();
  let mut guard = state.0.lock().expect("server state mutex poisoned");
  *guard = Some(child);

  Ok(runtime_origin.parse()?)
}

fn stop_packaged_server(app: &AppHandle) {
  let state = app.state::<ServerState>();
  let mut guard = state.0.lock().expect("server state mutex poisoned");
  if let Some(child) = guard.as_mut() {
    let _ = child.kill();
  }
  *guard = None;
}

fn wait_for_server_ready(
  child: &mut Child,
  port: u16,
  timeout: Duration,
) -> Result<(), Box<dyn Error>> {
  let deadline = Instant::now() + timeout;

  while Instant::now() < deadline {
    if child.try_wait()?.is_some() {
      return Err(io::Error::other(
        "Packaged Node server exited before the Tauri window could connect",
      )
      .into());
    }

    if TcpStream::connect(("127.0.0.1", port)).is_ok() {
      return Ok(());
    }

    thread::sleep(Duration::from_millis(200));
  }

  let _ = child.kill();
  Err(io::Error::other("Timed out waiting for the packaged Node server to become ready").into())
}

fn reserve_loopback_port() -> Result<u16, Box<dyn Error>> {
  let listener = TcpListener::bind(("127.0.0.1", 0))?;
  Ok(listener.local_addr()?.port())
}

fn resolve_standalone_server(standalone_dir: &Path) -> Option<PathBuf> {
  [
    standalone_dir.join("server.js"),
    standalone_dir.join("apps").join("web").join("server.js"),
  ]
  .into_iter()
  .find(|candidate| candidate.exists())
}

fn resolve_bundled_node(resource_dir: &Path) -> Option<PathBuf> {
  let node_dir = resource_dir.join("node");
  [
    node_dir.join("node.exe"),
    node_dir.join("bin").join("node"),
  ]
  .into_iter()
  .find(|candidate| candidate.exists())
}

fn load_runtime_env(app: &AppHandle, resource_dir: &Path) {
  if let Some(explicit_env_path) = env::var_os("STARCHILD_ENV_FILE") {
    let explicit_env_path = PathBuf::from(explicit_env_path);
    if explicit_env_path.is_file() {
      let _ = dotenvy::from_path_override(explicit_env_path);
      return;
    }
  }

  let exe_dir = env::current_exe()
    .ok()
    .and_then(|path| path.parent().map(Path::to_path_buf));
  let current_dir = env::current_dir().ok();
  let app_config_dir = app.path().app_config_dir().ok();
  let resource_standalone_dir = resource_dir.join("standalone");

  for candidate in [
    exe_dir.as_ref().map(|dir| dir.join(".env")),
    exe_dir.as_ref().map(|dir| dir.join(".env.local")),
    app_config_dir.as_ref().map(|dir| dir.join(".env")),
    app_config_dir.as_ref().map(|dir| dir.join(".env.local")),
    current_dir.as_ref().map(|dir| dir.join(".env")),
    current_dir.as_ref().map(|dir| dir.join(".env.local")),
    Some(resource_standalone_dir.join(".env")),
    Some(resource_standalone_dir.join(".env.local")),
  ]
  .into_iter()
  .flatten()
  {
    if candidate.is_file() {
      let _ = dotenvy::from_path_override(candidate);
    }
  }
}
