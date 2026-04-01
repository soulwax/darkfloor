<#
.SYNOPSIS
    Finds .exe, .deb, and .AppImage files recursively, excluding node_modules folders.

.DESCRIPTION
    This script searches the current directory and all subdirectories for
    files ending with .exe, .deb, or .AppImage. It explicitly ignores
    any files or directories located within a 'node_modules' folder,
    preventing traversal into them and filtering their contents from the results.

.NOTES
    Requires PowerShell 7 or later for optimal performance and cmdlet features.
    The exclusion is done by checking the full path of each item, making it
    robust for skipping 'node_modules' at any depth.

.EXAMPLE
    .\FindExecutablesAndPackages.ps1
    Runs the script from the current directory.

.EXAMPLE
    cd C:\MyProject
    .\FindExecutablesAndPackages.ps1
    Runs the script from 'C:\MyProject'.
#>

# Define the starting path for the search.
# '.' represents the current directory where the script is executed.
$StartPath = "." # "Here you can specify a different path if needed, e.g., 'C:\MyProjects'"

# Define the list of file extensions we are looking for.
# The leading dot is important for matching against the .Extension property.
$DesiredExtensions = @(".exe", ".deb", ".AppImage")

Write-Host "Searching for .exe, .deb, and .AppImage files in '$StartPath' (excluding node_modules folders)..."
Write-Host "--------------------------------------------------------------------------------------------------"

try {
    # Get-ChildItem: Core cmdlet for listing items in a directory.
    # -Path $StartPath: Specifies where to start the search.
    # -Recurse: Tells Get-ChildItem to search through all subdirectories.
    # -File: Ensures that only files are returned, not directories.
    #
    # First Where-Object: Filters out any item whose FullName (full path)
    # contains 'node_modules'. The regex `[\\/]node_modules[\\/] `
    # handles both Windows (\) and Unix-like (/) path separators.
    # This is crucial for ignoring node_modules content.
    # We use -notmatch to exclude paths containing 'node_modules' as a directory.
    #
    # Second Where-Object: Filters the remaining files to include only those
    # whose Extension property is present in our $DesiredExtensions array.
    # The -in operator is efficient for checking membership in a collection.
    #
    # Select-Object -ExpandProperty FullName: Outputs only the full path
    # of each matching file, making the output clean and directly usable.
    Get-ChildItem -Path $StartPath -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' } |
        Where-Object { $_.Extension -in $DesiredExtensions } |
        Select-Object -ExpandProperty FullName

}
catch {
    Write-Error "An error occurred during the search: $($_.Exception.Message)"
    Write-Error "Please ensure you have read access to the target directories."
}

Write-Host "--------------------------------------------------------------------------------------------------"
Write-Host "Search complete."

# End of script.
```

# ### How to use the script:

# 1.  **Save the script:**
#     *   Open a text editor (like Notepad, VS Code, or PowerShell ISE).
#     *   Copy and paste the entire script into the editor.
#     *   Save the file with a `.ps1` extension, for example, `FindExecutablesAndPackages.ps1`.

# 2.  **Open PowerShell 7:**
#     *   You can usually find it by searching for "PowerShell 7" in your Start Menu.

# 3.  **Navigate to the desired directory:**
#     *   Use `cd` (change directory) to go to the folder where you want to start the search.
#     *   For example: `cd C:\MyProjects`

# 4.  **Run the script:**
#     *   Execute the script by typing its name, prefixed with `.\` (which means "in the current directory"):
#         `.\FindExecutablesAndPackages.ps1`

# The script will then print the full paths of all `.exe`, `.deb`, and `.AppImage` files it finds, completely skipping anything inside `node_modules` folders.

# ### Explanation of key parts:

# *   **`$StartPath = "."`**: Sets the starting directory to the current directory where you run the script.
# *   **`$DesiredExtensions = @(".exe", ".deb", ".AppImage")`**: An array containing all the file extensions you want to find.
# *   **`Get-ChildItem -Path $StartPath -Recurse -File -ErrorAction SilentlyContinue`**:
#     *   `Get-ChildItem`: The core cmdlet for listing files and folders.
#     *   `-Path $StartPath`: Specifies where to begin the search.
#     *   `-Recurse`: Tells `Get-ChildItem` to go into all subdirectories.
#     *   `-File`: Restricts the output to only files (not folders).
#     *   `-ErrorAction SilentlyContinue`: Prevents the script from stopping if it encounters permissions issues in some folders, allowing it to continue searching accessible areas.
# *   **`Where-Object { $_.FullName -notmatch '[\\/]node_modules[\\/]' }`**:
#     *   This is the crucial part for excluding `node_modules`.
#     *   `$_.FullName`: Represents the full path of the current file being processed in the pipeline.
#     *   `-notmatch`: A regular expression operator that checks if a string *does not* match a pattern.
#     *   `'[\\/]node_modules[\\/]'`: This regex pattern looks for `node_modules` surrounded by path separators (`\` for Windows or `/` for Linux/macOS). This ensures we match `\node_modules\` or `/node_modules/` in the path, effectively identifying files *within* a `node_modules` directory.
# *   **`Where-Object { $_.Extension -in $DesiredExtensions }`**:
#     *   Filters the remaining files.
#     *   `$_.Extension`: The file extension (e.g., ".exe", ".deb").
#     *   `-in`: An operator that checks if an item is present in a collection (our `$DesiredExtensions` array).
# *   **`Select-Object -ExpandProperty FullName`**:
#     *   This ensures that only the absolute path of each found file is outputted, making the results clean and easy to read.
# *   **`try { ... } catch { ... }`**: Basic error handling to catch potential issues like permission denied errors during the search and provide a user-friendly message.