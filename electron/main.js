const { app, BrowserWindow, shell, Tray, Menu, nativeImage, Notification } = require("electron")
const path = require("path")
const { spawn } = require("child_process")

let mainWindow
let nextProcess
let tray

const isDev = process.env.NODE_ENV === "development"
const PORT = isDev ? 3000 : 3100

// ===== 앱 아이콘 =====
function getIconPath() {
  const iconName = process.platform === "win32" ? "icon.ico" : "icon.png"
  return path.join(__dirname, "..", "public", iconName)
}

// ===== 메인 윈도우 =====
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 12, y: 12 },
    icon: getIconPath(),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  // 로딩 완료 후 표시
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  // 외부 링크는 브라우저에서 열기
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url)
    return { action: "deny" }
  })

  // 창 닫기 → 트레이로 숨기기 (macOS/Windows)
  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ===== 시스템 트레이 =====
function createTray() {
  const iconPath = getIconPath()
  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 18, height: 18 })
  } catch {
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip("ChatApp")

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "ChatApp 열기",
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        } else {
          createWindow()
        }
      },
    },
    { type: "separator" },
    {
      label: "새 채팅",
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.executeJavaScript('window.location.href="/chat"')
        }
      },
    },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    } else {
      createWindow()
    }
  })
}

// ===== 알림 =====
function showNotification(title, body) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title,
      body,
      icon: getIconPath(),
    })
    notification.on("click", () => {
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
    notification.show()
  }
}

// ===== Next.js 서버 =====
function startNextServer() {
  return new Promise((resolve) => {
    if (isDev) {
      resolve()
      return
    }

    nextProcess = spawn("npm", ["run", "start"], {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, PORT: String(PORT) },
      stdio: "pipe",
      shell: true,
    })

    nextProcess.stdout.on("data", (data) => {
      const output = data.toString()
      console.log("[Next.js]", output)
      if (output.includes("Ready") || output.includes("started")) {
        resolve()
      }
    })

    nextProcess.stderr.on("data", (data) => {
      console.error("[Next.js Error]", data.toString())
    })

    setTimeout(resolve, 8000)
  })
}

// ===== 자동 업데이트 =====
function setupAutoUpdater() {
  try {
    const { autoUpdater } = require("electron-updater")
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on("update-available", () => {
      showNotification("업데이트 available", "새 버전을 다운로드 중입니다...")
    })

    autoUpdater.on("update-downloaded", () => {
      showNotification("업데이트 준비 완료", "재시작하면 업데이트가 적용됩니다.")
    })
  } catch {
    // electron-updater가 없거나 개발 모드
  }
}

// ===== 앱 시작 =====
app.whenReady().then(async () => {
  await startNextServer()
  createWindow()
  createTray()

  if (!isDev) setupAutoUpdater()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

// macOS: 모든 창 닫아도 트레이에서 실행 유지
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Windows/Linux: 트레이에서 계속 실행
  }
})

app.on("before-quit", () => {
  app.isQuitting = true
  if (nextProcess) nextProcess.kill()
})

// 중복 실행 방지
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}
