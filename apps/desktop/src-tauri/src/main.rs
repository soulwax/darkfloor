#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
  env,
  error::Error,
  fs::{self, OpenOptions},
  io,
  io::Write,
  net::{TcpListener, TcpStream},
  path::{Path, PathBuf},
  process::{Child, Command, Stdio},
  sync::Mutex,
  thread,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Deserialize;
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
struct ServerState(Mutex<Option<Child>>);

#[derive(Debug, Deserialize)]
struct RuntimeEnvResolution {
  source: Option<String>,
  mode: String,
  values: std::collections::BTreeMap<String, String>,
}

fn main() {
  let app = tauri::Builder::default()
    .manage(ServerState::default())
    .setup(|app| {
      let handle = app.handle();

      if cfg!(debug_assertions) {
        let window_url = "http://127.0.0.1:3222".parse()?;
        return build_main_window(&handle, window_url);
      }

      match start_packaged_server(&handle) {
        Ok(window_url) => build_main_window(&handle, window_url),
        Err(error) => {
          log_startup(
            &handle,
            format!("Packaged startup failed: {error}"),
          );

          if let Some(error_page) = write_startup_error_page(&handle, &error.to_string()) {
            if let Ok(error_url) = url::Url::from_file_path(&error_page) {
              WebviewWindowBuilder::new(app, "startup-error", WebviewUrl::External(error_url))
                .title("Starchild Tauri Experimental")
                .inner_size(980.0, 720.0)
                .min_inner_size(760.0, 560.0)
                .resizable(true)
                .build()?;
              return Ok(());
            }
          }

          Err(error)
        }
      }
    })
    .build(tauri::generate_context!());

  match app {
    Ok(app) => app.run(|app, event| {
      if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
        stop_packaged_server(app);
      }
    }),
    Err(error) => {
      log_early_startup(format!("Failed to build Tauri application: {error}"));
    }
  }
}

fn build_main_window(app: &AppHandle, window_url: url::Url) -> tauri::Result<()> {
  WebviewWindowBuilder::new(app, "main", WebviewUrl::External(window_url))
    .title("Starchild Tauri Experimental")
    .inner_size(1440.0, 920.0)
    .min_inner_size(1100.0, 720.0)
    .resizable(true)
    .build()?;

  Ok(())
}

fn start_packaged_server(app: &AppHandle) -> Result<url::Url, Box<dyn Error>> {
  let resource_dir = app.path().resource_dir()?;
  let standalone_dir = resource_dir.join("standalone");
  log_startup(app, format!("Resource dir: {}", resource_dir.display()));
  log_startup(app, format!("Standalone dir: {}", standalone_dir.display()));
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
  log_startup(app, format!("Bundled Node: {}", node_path.display()));
  log_startup(app, format!("Standalone server: {}", server_path.display()));
  let runtime_env = load_runtime_env(app, &resource_dir, &node_path)?;
  log_startup(
    app,
    format!(
      "Runtime env mode: {} ({})",
      runtime_env.mode,
      runtime_env
        .source
        .as_deref()
        .unwrap_or("no external source"),
    ),
  );

  let server_port = reserve_loopback_port()?;
  let runtime_origin = format!("http://127.0.0.1:{server_port}");
  let mut command = Command::new(&node_path);
  command.arg(&server_path);
  if let Some(server_dir) = server_path.parent() {
    command.current_dir(server_dir);
  } else {
    command.current_dir(&standalone_dir);
  }
  command.stdin(Stdio::null());
  #[cfg(windows)]
  command.creation_flags(CREATE_NO_WINDOW);
  let startup_log = open_startup_log_file(app)?;
  command.stdout(Stdio::from(startup_log.try_clone()?));
  command.stderr(Stdio::from(startup_log));
  command.envs(runtime_env.values);
  command.env("STARCHILD_RUNTIME_ENV_MODE", &runtime_env.mode);
  if let Some(source) = runtime_env.source.as_ref() {
    command.env("STARCHILD_RUNTIME_ENV_SOURCE", source);
  }
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
  log_startup(
    app,
    format!("Spawned packaged Node server on port {server_port}"),
  );
  wait_for_server_ready(&mut child, server_port, Duration::from_secs(30))?;
  log_startup(
    app,
    format!("Packaged Node server became ready on {runtime_origin}"),
  );

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

fn load_runtime_env(
  app: &AppHandle,
  resource_dir: &Path,
  node_path: &Path,
) -> Result<RuntimeEnvResolution, Box<dyn Error>> {
  let exe_dir = env::current_exe()
    .ok()
    .and_then(|path| path.parent().map(Path::to_path_buf));
  let current_dir = env::current_dir().ok();
  let app_config_dir = app.path().app_config_dir().ok();
  let resolver_script = resource_dir.join("runtime").join("resolve-runtime-env.cjs");
  log_startup(
    app,
    format!("Runtime env resolver: {}", resolver_script.display()),
  );

  if !resolver_script.is_file() {
    return Ok(RuntimeEnvResolution {
      source: None,
      mode: String::from("none"),
      values: std::collections::BTreeMap::new(),
    });
  }

  let mut command = Command::new(node_path);
  command
    .env("STARCHILD_RUNTIME_ENV_OUTPUT", "json")
    .arg(&resolver_script)
    .arg(resource_dir)
    .arg(exe_dir.as_deref().unwrap_or_else(|| Path::new("")))
    .arg(app_config_dir.as_deref().unwrap_or_else(|| Path::new("")))
    .arg(current_dir.as_deref().unwrap_or_else(|| Path::new("")))
    .stdin(Stdio::null())
    .stderr(Stdio::piped())
    .stdout(Stdio::piped());
  #[cfg(windows)]
  command.creation_flags(CREATE_NO_WINDOW);
  let output = command.output()?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    log_startup(
      app,
      format!("Runtime env resolution failed: {}", stderr.trim()),
    );
    return Err(io::Error::other(format!(
      "Failed to resolve runtime env: {}",
      stderr.trim()
    ))
    .into());
  }

  let stdout = String::from_utf8(output.stdout)?;
  let resolution: RuntimeEnvResolution = serde_json::from_str(stdout.trim())?;
  Ok(resolution)
}

fn startup_log_path(app: &AppHandle) -> PathBuf {
  if let Ok(log_dir) = app.path().app_log_dir() {
    return log_dir.join("tauri-startup.log");
  }

  if let Ok(config_dir) = app.path().app_config_dir() {
    return config_dir.join("logs").join("tauri-startup.log");
  }

  env::temp_dir().join("starchild-tauri-startup.log")
}

fn early_startup_log_path() -> PathBuf {
  env::temp_dir().join("starchild-tauri-startup-early.log")
}

fn log_early_startup(message: impl AsRef<str>) {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_secs())
    .unwrap_or(0);
  let line = format!("[{timestamp}] [Tauri] {}", message.as_ref());

  if let Some(parent) = early_startup_log_path().parent() {
    let _ = fs::create_dir_all(parent);
  }

  if let Ok(mut file) = OpenOptions::new()
    .create(true)
    .append(true)
    .open(early_startup_log_path())
  {
    let _ = writeln!(file, "{line}");
  }
}

fn open_startup_log_file(app: &AppHandle) -> Result<std::fs::File, Box<dyn Error>> {
  let log_path = startup_log_path(app);
  if let Some(parent) = log_path.parent() {
    fs::create_dir_all(parent)?;
  }

  Ok(
    OpenOptions::new()
      .create(true)
      .append(true)
      .open(log_path)?,
  )
}

fn log_startup(app: &AppHandle, message: impl AsRef<str>) {
  let timestamp = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_secs())
    .unwrap_or(0);
  let line = format!("[{timestamp}] [Tauri] {}", message.as_ref());
  eprintln!("{line}");

  if let Ok(mut file) = open_startup_log_file(app) {
    let _ = writeln!(file, "{line}");
  }
}

fn escape_html(value: &str) -> String {
  value
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
}

fn write_startup_error_page(app: &AppHandle, error: &str) -> Option<PathBuf> {
  let log_path = startup_log_path(app);
  let output_dir = app
    .path()
    .app_config_dir()
    .ok()
    .unwrap_or_else(env::temp_dir)
    .join("startup");

  if fs::create_dir_all(&output_dir).is_err() {
    return None;
  }

  let error_path = output_dir.join("startup-error.html");
  let html = format!(
    r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Starchild Tauri Experimental</title>
    <style>
      body {{
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: #0b0e14;
        color: #f3f5f7;
      }}
      main {{
        max-width: 880px;
        margin: 0 auto;
        padding: 40px 24px 56px;
      }}
      h1 {{
        margin: 0 0 12px;
        font-size: 30px;
      }}
      p {{
        line-height: 1.6;
        color: #c7ced8;
      }}
      .panel {{
        margin-top: 24px;
        padding: 18px 20px;
        border-radius: 16px;
        background: #141a23;
        border: 1px solid #273140;
      }}
      code, pre {{
        font-family: "Cascadia Mono", "Consolas", monospace;
      }}
      pre {{
        white-space: pre-wrap;
        word-break: break-word;
        color: #ffd7a8;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>Startup failed</h1>
      <p>
        The packaged Node/Next runtime did not start, so the experimental Tauri shell could not open the app.
      </p>
      <div class="panel">
        <strong>Startup log</strong>
        <pre>{}</pre>
      </div>
      <div class="panel">
        <strong>Error details</strong>
        <pre>{}</pre>
      </div>
    </main>
  </body>
</html>"#,
    escape_html(&log_path.display().to_string()),
    escape_html(error),
  );

  fs::write(&error_path, html).ok()?;
  Some(error_path)
}
