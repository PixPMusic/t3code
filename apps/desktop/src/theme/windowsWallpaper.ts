// @effect-diagnostics nodeBuiltinImport:off -- Windows COM lookup is a desktop platform boundary.

import * as NodeChildProcess from "node:child_process";
import * as NodePath from "node:path";

// Query the primary monitor explicitly: GetWallpaper(null) can return an empty
// path for slideshows or different wallpapers on each monitor. COM slot order
// follows IDesktopWallpaper in the Windows SDK (available since Windows 8).
const wallpaperScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class T3Wallpaper {
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect { public int Left, Top, Right, Bottom; }

    [ComImport, Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IDesktopWallpaper {
        [PreserveSig] int SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitor, [MarshalAs(UnmanagedType.LPWStr)] string path);
        [PreserveSig] int GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitor, [MarshalAs(UnmanagedType.LPWStr)] out string path);
        [PreserveSig] int GetMonitorDevicePathAt(uint index, [MarshalAs(UnmanagedType.LPWStr)] out string monitor);
        [PreserveSig] int GetMonitorDevicePathCount(out uint count);
        [PreserveSig] int GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string monitor, out Rect rect);
    }

    public static string Read() {
        var type = Type.GetTypeFromCLSID(new Guid("C2CF3110-460E-4FC1-B9D0-8A1C0C9CC4BD"));
        var desktop = (IDesktopWallpaper)Activator.CreateInstance(type);
        try {
            uint count;
            Marshal.ThrowExceptionForHR(desktop.GetMonitorDevicePathCount(out count));
            for (uint i = 0; i < count; i++) {
                string monitor;
                Marshal.ThrowExceptionForHR(desktop.GetMonitorDevicePathAt(i, out monitor));
                Rect rect;
                int status = desktop.GetMonitorRECT(monitor, out rect);
                Marshal.ThrowExceptionForHR(status);
                // S_FALSE means a remembered, disconnected monitor. Windows
                // places the primary monitor's upper-left corner at (0, 0).
                if (status != 0 || rect.Left != 0 || rect.Top != 0) continue;
                string path;
                Marshal.ThrowExceptionForHR(desktop.GetWallpaper(monitor, out path));
                return path;
            }
            throw new InvalidOperationException("No primary monitor wallpaper");
        } finally {
            Marshal.ReleaseComObject(desktop);
        }
    }
}
'@
[T3Wallpaper]::Read() | ConvertTo-Json -Compress
`;

export async function readWindowsWallpaperPath(): Promise<string> {
  const systemRoot = process.env.SystemRoot ?? process.env.WINDIR;
  const powershell = systemRoot
    ? NodePath.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
    : "powershell.exe";
  const output = await new Promise<string>((resolve, reject) => {
    NodeChildProcess.execFile(
      powershell,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", wallpaperScript],
      { encoding: "utf8", timeout: 10_000, maxBuffer: 32 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error) reject(new Error("Could not read the current wallpaper."));
        else resolve(stdout);
      },
    );
  });
  let path: unknown;
  try {
    path = JSON.parse(output);
  } catch {
    throw new Error("Could not read the current wallpaper.");
  }
  // Keep automatic sampling on this device; do not follow a UNC/network path.
  if (typeof path !== "string" || !/^[a-z]:\\/i.test(path) || path.includes("\0")) {
    throw new Error("The current wallpaper is not a local image. Choose an image instead.");
  }
  return path;
}
