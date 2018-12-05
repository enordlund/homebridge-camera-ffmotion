# homebridge-camera-ffmotion

A hybrid of homebridge-camera-ffmpeg and homebridge-camera-motion that works.

## Why?

In my experience, the two previously mentioned Homebridge plugins seem to have their own strengths and weaknesses when it comes to reliability: homebridge-camera-ffmpeg offers a reliable video stream, and homebridge-camera-motion offers reliable camera snapshots with a linked motion sensor accessory. However, each plugin fails to accomplish the others' strengths on my Raspberry Pi 3.

## The Goal

For the first version, I will be combining the code of these two plugins so that homebridge-camera-ffmpeg will gain motion sensor and snapshot functionality. I am also considering the addition of more features for the future.

## Installation

### Motion Detection

#### Install Motion

#### Add homebridge-fixfifo.sh to boot script
Run homebridge-fixfifo.sh in a boot script like /etc/local.rc to fix fifo issues with motion-pipe.
Edit the file to match your user/path info.

### Example Configuration

```
{
	"platform": "Camera-ffmotion",
	"cameras": [
	{
		"name": "Camera Name",
		"videoConfig": {
			"source": "-re -i rtsp://myfancy_rtsp_stream",
			"snapshotPath": "/tmp/lastsnap.jpg",
			"maxStreams": 2,
			"maxWidth": 1280,
			"maxHeight": 720,
			"maxFPS": 30,
			"maxBitrate": 200,
			"vcodec": "h264_omx",
			"audio": true,
			"packetSize": 188,
			"debug": true
		},
		"motionConfig": {
			"name": "Motion Sensor Name",
			"pipe": "/tmp/motion-pipe",
			"timeout": 2000
		}
	}
  ]
}
```