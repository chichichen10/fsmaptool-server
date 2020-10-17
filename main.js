const { app, BrowserWindow, Menu, Tray, shell } = require('electron');
const simConnect = require('node-simconnect');
const express = require('express');
const internalIp = require('internal-ip');
const unhandled = require('electron-unhandled');
const log = require('electron-log');
const path = require('path');

const server = express();
const port = 12345;

unhandled();

let data = null;
let tray = null;
let ipAddress = "";
const version = app.getVersion();

const setConnected = flag => {
  if (tray) tray.setImage(path.join(__dirname, flag ? 'icon2.png' : 'icon.png'));
}

log.info('App init');

app.whenReady().then(() => {
  log.info('App ready');
  ipAddress = internalIp.v4.sync();
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    { label: `FS Map Tool v${version}`, type: 'normal', enabled: false },
    { label: `IP: ${ipAddress}`, type: 'normal', enabled: false },
    { label: 'Website', type: 'normal', click: () => shell.openExternal('http://www.fsmaptool.com') },
    { label: '', type: 'separator' },
    { label: 'Quit', type: 'normal', click: () => quitApp(), role: 'quit' }
  ]);
  tray.setToolTip(`FS Map Tool v${version}`);
  tray.setContextMenu(contextMenu);
  tray.setIgnoreDoubleClickEvents(true);
  tray.on('click', () => tray.popUpContextMenu());
  startServer();
  connectToSim();
});

app.on('window-all-closed', () => quitApp());

function quitApp() {
  tray.destroy();
  tray = null;
  app.quit();
}

function startServer() {
  server.get('/data', (req, res) => res.send(data ? data : {"error": "no-data"}));
  server.listen(port, () => log.info(`Server listening at http://localhost:${port}`));
}

function connectToSim() {
  log.info("Trying to connect...");

  const connection = simConnect.open("myApp", function(name, version) {
    log.info(`Connected to: ${name} SimConnect version: ${version}`);
    setConnected(true);
    startPolling();
  }, () => {
    log.warn("Quit... :(");
    setConnected(false);
    connectToSim();
  }, (exception) => {
    log.error(`SimConnect exception: ${exception.name} (${exception.dwException}, ${exception.dwSendID}, ${exception.dwIndex}, ${exception.cbData})`);
    setConnected(false);
  }, (error) => {
    log.error(`SimConnect error: ${error}`);
    setConnected(false);
    connectToSim();
  });

  if (!connection) {
    setConnected(false);
    setTimeout(() => connectToSim(), 5000);
  }
}

function startPolling() {
  simConnect.requestDataOnSimObject([
    ["Plane Latitude", "degrees"], 
    ["Plane Longitude", "degrees"], 
    ["PLANE ALTITUDE", "feet"],
    ["PLANE HEADING DEGREES TRUE", "degrees"]
  ], (response) => {
    data = {
      lat: response["Plane Latitude"],
      lon: response["Plane Longitude"],
      alt: response["PLANE ALTITUDE"],
      head: response["PLANE HEADING DEGREES TRUE"]
    };
    // log.log(data);
  }, 0, 4, 1);
}