// FIFO for motion pipe
const FIFO = require('fifo-js');

var Accessory, hap, UUIDGen;

var FFMPEG = require('./ffmpeg').FFMPEG;

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  hap = homebridge.hap;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform("homebridge-camera-ffmotion", "Camera-ffmotion", ffmpegPlatform, true);
}

function ffmpegPlatform(log, config, api) {
  var self = this;

  self.log = log;
  self.config = config || {};
  
  if (api) {
    self.api = api;

    if (api.version < 2.1) {
      throw new Error("Unexpected API version.");
    }
    
    // Optionally adding motion sensor
    if (config.motionConfig) {
        // from homebridge-camera-motion
        this.motionAccessory = new CameraMotionAccessory(log, config, api);
        // end
    } else {
        console.log('No motion sensor configuration.');
    }
    
    self.api.on('didFinishLaunching', self.didFinishLaunching.bind(this));
  } else {
    console.log('ERROR: No api');
  }
  
}

ffmpegPlatform.prototype.configureAccessory = function(accessory) {
  // Won't be invoked
}

ffmpegPlatform.prototype.didFinishLaunching = function() {
  var self = this;
  var videoProcessor = self.config.videoProcessor || 'ffmpeg';

  if (self.config.cameras) {
    var configuredAccessories = [];

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
      // adding motion sensor
      this.motionAccessory.setSource(cameraSource);
      configuredAccessories.push(cameraAccessory);
    });

    self.api.publishCameraAccessories("Camera-ffmpeg", configuredAccessories);
  }
}

// An accessory with a MotionSensor service (from homebridge-camera-motion)
class CameraMotionAccessory
{
  constructor(log, config, api) {
    log(`CameraMotion accessory starting`);
    this.log = log;
    this.api = api;// This might be unsafe, but the constructor is only called within if(api)
    config = config || {};
    let defaultName = 
    this.name = config.motionConfig.name || 'Motion Detector';

    this.pipePath = config.motionConfig.pipe || '/tmp/motion-pipe';
    this.timeout = config.motionConfig.timeout !== undefined ? config.motionConfig.timeout : 2000;

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
    const [filename, filetype, event, width, height, x, y, noise, dpixels] = text.trim().split('\t');
    console.log('filename is',filename);
    this.cameraSource.snapshot_path = filename;
    this.setMotion(true);

    setTimeout(() => this.setMotion(false), this.timeout); // TODO: is this how this works?
  }

  getServices() {
    return [this.motionService];
  }
}