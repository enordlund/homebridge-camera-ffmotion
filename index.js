// FIFO for motion pipe
const FIFO = require('fifo-js');

var Accessory, hap, UUIDGen;

var Service, Characteristic;//added for CameraMotionAccessory

var FFMPEG = require('./ffmpeg').FFMPEG;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  hap = homebridge.hap;
  UUIDGen = homebridge.hap.uuid;
  
  Service = homebridge.hap.Service;//added for CameraMotionAccessory
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerPlatform("homebridge-camera-ffmotion", "Camera-ffmotion", ffmpegPlatform, true);
}

function ffmpegPlatform(log, config, api) {
  console.log('constructor called');
  var self = this;

  self.log = log;
  self.config = config || {};
  
  self.motionAccessories = [];
  
  if (api) {
    self.api = api;

    if (api.version < 2.1) {
      throw new Error("Unexpected API version.");
    }
    
    if (self.config.cameras) {
    
      var cameras = self.config.cameras;
      cameras.forEach(function(cameraConfig) {
        var cameraName = cameraConfig.name;

        if (!cameraName) {
          self.log("Missing parameters.");
          return;
        }
        
        // Optionally adding motion sensor
        if (cameraConfig.motionConfig) {
            var motionConfig = cameraConfig.motionConfig;
            // from homebridge-camera-motion
            var motionAccessory = new CameraMotionAccessory(self.log, motionConfig, self.api);
            // end 
            self.motionAccessories.push(motionAccessory);
        } else {
            console.log('No motion sensor configuration for camera: ' + cameraName);
        }
      });
    }
    
    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  } else {
    console.log('ERROR: No api');
  }
  
}
/*
ffmpegPlatform.prototype.configureAccessory = function(accessory) {
  // Won't be invoked
}
*/

// Copied from h-c-m
ffmpegPlatform.prototype.accessories = function(cb) {
    console.log('accessories() called');
    var self = this;
    cb(self.motionAccessories);
}

ffmpegPlatform.prototype.didFinishLaunching = function() {
  console.log('didFinishLaunching() called');
  var self = this;
  var videoProcessor = self.config.videoProcessor || 'ffmpeg';

  if (self.config.cameras) {
    var configuredAccessories = [];
    
    var motionCameraSources = [];

    var cameras = self.config.cameras;
    cameras.forEach(function(cameraConfig) {
      var cameraName = cameraConfig.name;
      var videoConfig = cameraConfig.videoConfig;

      if (!cameraName || !videoConfig) {
        self.log("Missing parameters.");
        return;
      }

      var uuid = UUIDGen.generate(cameraName);
      var cameraAccessory = new Accessory(cameraName, uuid, hap.Accessory.Categories.CAMERA);
      var cameraSource = new FFMPEG(hap, cameraConfig, self.log, videoProcessor);
      cameraAccessory.configureCameraSource(cameraSource);
      configuredAccessories.push(cameraAccessory);
      
      // Optionally adding motion sensor
      if (cameraConfig.motionConfig) {
          motionCameraSources.push(cameraSource);
      } else {
          console.log('No motion sensor configuration for camera: ' + cameraName);
      }
    });
    
    self.motionAccessories.forEach(function(motionAccessory) {
      var source = motionCameraSources.shift();
      motionAccessory.setSource(source);
    });

    self.api.publishCameraAccessories("Camera-ffmotion", configuredAccessories);
  }
}

// An accessory with a MotionSensor service (from homebridge-camera-motion)
class CameraMotionAccessory
{
  constructor(log, motionConfig, api) {
    log(`FFMotion motion accessory starting`);
    this.log = log;
    this.api = api;// This might be unsafe, but the constructor is only called within if(api)
    motionConfig = motionConfig || {};
    let defaultName = motionConfig.name + ' Motion Sensor';
    this.name = motionConfig.name || defaultName;

    this.pipePath = motionConfig.pipe || '/tmp/motion-pipe';
    this.timeout = motionConfig.timeout !== undefined ? motionConfig.timeout : 2000;

    this.pipe = new FIFO(this.pipePath);
    this.pipe.setReader(this.onPipeRead.bind(this));

    this.motionService = new Service.MotionSensor(this.name);
    this.setMotion(false);
  }

  setSource(cameraSource) {
    this.cameraSource = cameraSource;
  }

  setMotion(detected) {
    this.motionService
      .getCharacteristic(Characteristic.MotionDetected)
      .setValue(detected);
  }

  onPipeRead(text) {
    console.log(`got from pipe: |${text}|`);
    // on_picture_save printf '%f\t%n\t%v\t%i\t%J\t%K\t%L\t%N\t%D\n' > /tmp/camera-pipe
    // http://htmlpreview.github.io/?https://github.com/Motion-Project/motion/blob/master/motion_guide.html#conversion_specifiers
    // %f filename with full path
    // %n number indicating filetype
    // %v event
    // %i width of motion area
    // %J height of motion area
    // %K X coordinates of motion center
    // %L Y coordinates of motion center
    // %N noise level
    // %D changed pixels
    /*
    const [filename, filetype, event, width, height, x, y, noise, dpixels] = text.trim().split('\t');
    console.log('filename is',filename);
    this.cameraSource.snapshotPath = filename;
    */
    this.setMotion(true);

    setTimeout(() => this.setMotion(false), this.timeout); // TODO: is this how this works?
  }

  getServices() {
    return [this.motionService];
  }
}