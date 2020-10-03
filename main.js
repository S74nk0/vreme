// Modules to control application life and create native browser window
const { app, BrowserWindow } = require("electron");
const spawn = require("child_process").spawn;
const exec = require("child_process").exec;

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: true, // release lahko daš tole
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      devTools: true,
      javascript: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      disableHtmlFullscreenWindowResize: false,
      zoomFactor: 2.0,
    },
  });

  const pages = [
    { "id": 1, "name": "TemnicaVreme", "url": "https://www.google.com/search?q=temnica+vreme" },
    { "id": 2, "name": "Radarska", "url": "http://meteo.arso.gov.si/uploads/probase/www/observ/radar/si0-rm-anim.gif" },
    { "id": 3, "name": "RenčeVreme", "url": "https://www.google.com/search?q=renče+vreme" }
  ];
  let selectPageIndex = -1;
  const goToPage = (nameOrId = "TemnicaVreme") => {
    const index = pages.findIndex(page => page.id == nameOrId || page.name == nameOrId);
    if (selectPageIndex != index && index != -1) {
      const url = pages[index].url;
      selectPageIndex = index;
      mainWindow.loadURL(url);
    }
  };
  goToPage();

  const initVreme = () => {
    const execVreme = `
      const wob_wc = document.getElementById('wob_wc');
      const dnevi = document.getElementById('wob_db');
      const nextTempPadavineVeter = (() => {
        let current = 0;
        const next = (prev = false) => {
          const n = (prev ? -1 : 1);
          current = (current+n)%3;
          if (current < 0) current = 2;
          const temperature = document.getElementById('wob_temp');
          const rain = document.getElementById('wob_rain');
          const wind = document.getElementById('wob_wind');
          if (current == 0) temperature.click();
          if (current == 1) rain.click();
          if (current == 2) wind.click();
        } 
        return next;
      })();
      const nextDay = (() => {
        let current = 0;
        const next = (prev = false) => {
          const n = (prev ? -1 : 1);
          current = (current+n)%8;
          if (current < 0) current = 7;
          const day = wob_wc.getElementsByClassName("gic")[1].firstElementChild.getElementsByClassName('wob_df')[current];
          day.click();
        } 
        return next;
      })();
      const hideOther = () => {
        const hideIds = ["searchform","top_nav", "appbar", "taw", "botstuff", "foot"];
        Array.from(document.body.getElementsByTagName("div")).forEach(d => {if (hideIds.includes(d.id)) d.style = "display:none"});
        Array.from(document.getElementById('rso').getElementsByTagName("div")).forEach(el => {
          if (el.classList.contains("g") && !el.classList.contains("knavi")) el.style = "display:none"
        });
        Array.from(document.getElementById('rso').getElementsByTagName("g-section-with-header")).forEach(el => {el.style = "display:none"});
      }
      document.addEventListener('keypress', (e) => {
        // alert(e.code);
        // always go fullscreen
        hideOther();
        wob_wc.requestFullscreen();
        if (e.code == 'Enter' || e.code == 'NumpadEnter') {
          nextTempPadavineVeter();  
        }
        if (e.code == 'NumpadAdd' || e.code == 'KeyN') {
          nextDay();
        }
      });
      document.addEventListener('keydown', (e) => {
        // alert(e.code);
        // always go fullscreen
        hideOther();
        wob_wc.requestFullscreen();
        if (e.code == 'ArrowRight') {
           nextDay();
        }
        if (e.code == 'ArrowLeft') {
           nextDay(true);
        }
        if (e.code == 'ArrowUp') {
          nextTempPadavineVeter(); 
        }
        if (e.code == 'ArrowDown') {
          nextTempPadavineVeter(true); 
        }
      });
      hideOther();
      `;

    mainWindow.webContents.executeJavaScript(execVreme);

    const injectCSS = `
      /* disable selection */
      :not(input):not(textarea),
      :not(input):not(textarea)::after,
      :not(input):not(textarea)::before {
          -webkit-user-select: none;
          user-select: none;
          cursor: default;
      }
      input, button, textarea, :focus {
          outline: none;
      }

      /* disable image and anchor dragging */
      a:not([draggable=true]), img:not([draggable=true]) {
          -webkit-user-drag: none;
          user-drag: none;
      }
      a[href^="http://"],
      a[href^="https://"],
      a[href^="ftp://"] {
          -webkit-user-drag: auto;
          user-drag: auto;
      }`;

    mainWindow.webContents.insertCSS(injectCSS);

    let count = 0;
    const pressA_interval = setInterval(() => {
      let bat = spawn("xdotool", ["key", "a"]);
      bat.on("error", () => { });
      count = 1 + count;
      if (count == 5) clearInterval(pressA_interval);
    }, 1000);
  };

  mainWindow.webContents.on("did-finish-load", () => {
    initVreme();
  });

  // // reload every 15 minutes - RELOAD on Space
  // const reloadInterval = 15 * 60 * 1000
  // setInterval(() => mainWindow.reload(), reloadInterval)

  let lastSpaceInput = new Date().getTime() | 0;
  let isUpdateCalled = false
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // For example, only enable application menu keyboard shortcuts when
    // Ctrl/Cmd are down.
    // win.webContents.setIgnoreMenuShortcuts(!input.control && !input.meta)

    if (input.key == "Space" || input.code == "Space") {
      const nowSpaceInput = new Date().getTime() | 0;
      const diff = (nowSpaceInput - lastSpaceInput) / 1000;
      // allow restart every 6 seconds
      if (diff > 6) {
        lastSpaceInput = nowSpaceInput;
        event.preventDefault();
        mainWindow.reload();
      }
      event.preventDefault();
    }
    if (input.key == "KeyU" || input.code == "KeyU") {
      console.log("UPDATE");
      if (!isUpdateCalled) {
        exec('cd electron_vreme && git pull origin && reboot', (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);
        });
      }
      isUpdateCalled = true;
    }

    if (input.key.includes("Digit1") || input.code.includes("Digit1")) {
      goToPage(1);
    }
    if (input.key.includes("Digit2") || input.code.includes("Digit2")) {
      goToPage(2);
    }
    if (input.key.includes("Digit3") || input.code.includes("Digit3")) {
      goToPage(3);
    }
  });

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
