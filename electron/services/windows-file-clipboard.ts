import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const FILE_PATHS_ENV = "LYCEUM_CLIPBOARD_FILE_PATHS";

const FILE_DROP_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
$json = [Environment]::GetEnvironmentVariable('${FILE_PATHS_ENV}')
$paths = ConvertFrom-Json -InputObject $json
$files = New-Object System.Collections.Specialized.StringCollection
@($paths) | ForEach-Object {
  if ($_ -is [string] -and $_.Length -gt 0) {
    [void]$files.Add($_)
  }
}
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
`;

export function buildWindowsFileClipboardCommand(filePaths: string[]) {
  const paths = [...new Set(filePaths)].filter(Boolean);
  if (paths.length === 0) {
    throw new Error("Nenhum arquivo encontrado");
  }

  return {
    executable: "powershell.exe",
    args: [
      "-NoProfile",
      "-NonInteractive",
      "-STA",
      "-EncodedCommand",
      Buffer.from(FILE_DROP_SCRIPT, "utf16le").toString("base64"),
    ],
    env: {
      ...process.env,
      [FILE_PATHS_ENV]: JSON.stringify(paths),
    },
  };
}

export async function copyWindowsFilesToClipboard(filePaths: string[]) {
  const command = buildWindowsFileClipboardCommand(filePaths);
  await execFileAsync(command.executable, command.args, {
    env: command.env,
    windowsHide: true,
  });
}
