
<template>
	
	<div id="app">
		<div id="connectStatus">
			<span>{{connectMessage}}</span><br>
			<button type="button" name="button" @click="resetConfiguration($event)">reset</button>
		</div>
		
		
		<div id="connectBox" v-if="connectStatus !== 'connected'">
			
			<span>Enter your Bridge IP or hostname</span>
			
			<div id="bridgeForm">
				<input type="text" name="bridgeAddress" v-model="bridgeAddress">
				<button type="button" name="connectBridgeBtn" @click="connectBridge()">connect</button>
			</div>
			
			<span id="discoverBridgeLink" @click="discoverBridge()">
				Attempt automatic discovering
			</span>
			
		</div>
		
		<template v-if="connectStatus === 'connected'">
			<div class="introduction">
				Configure light positions below. Positions are saved locally in your browser for future sessions.
			</div>
			<button type="button" name="resetAll" @click="resetConfiguration($event)"></button>
			<div class="lightList">
				<template v-for="light in lights">
					<span>{{light.number}}</span>
					<span :style="{backgroundColor:light.color}">{{light.name}}</span><span>{{light.position}}</span><span>{{light.color}}</span><button type="button" @click="configureLight($event, light)">position with controller</button>
					<br><br>
				</template>
			</div>
			
			<button type="button" name="recalibrate" @click="repositionAllBasedOnCalibrationLight()">recalibrate</button>
			
			
		</template>
		<a-scene embedded debug>
			<a-camera>
			</a-camera>
			
			
			
			<a-sky color="#dad6d6"></a-sky>
			<template v-for="light in configuredLights">
				<a-text :value="light.name" :position="light.position | stringPos"></a-text>
				<a-sphere class="lights" :number="light.number" :id="light.uuid" :radius="light.radius" :color="light.color" :position="light.position | stringPos" @mouseenter="hoverLight($event, light)"
				@mouseleave="hoverLight($event, light)"
				@click="toggleLight($event, light)"></a-sphere>
			</template>
			
			<a-entity id="rightHand" @axismove="axismove($event)" @buttondown="buttonDown($event)" @buttonup="buttonUp($event)" hand-controls="right" controller-cursor>
			</a-entity>
			
			<a-entity id="leftHand" @axismove="axismove($event)" @buttondown="buttonDown($event)" @buttonup="buttonUp($event)" hand-controls="left" controller-cursor>
			</a-entity>
			
			<a-plane color="rgb(119, 119, 119)" height="100" width="100" rotation="-90 0 0"></a-plane>
			
		</a-scene>
		
		
	</div>
</template>


<script>
// import AFRAME from 'aframe'; // doesn not allow embedded mode? so use script tag instead for now
import controllerCursor from 'aframe-controller-cursor-component';
AFRAME.registerComponent('aframe-controller-cursor-component', controllerCursor);
import jshue from './jshue.js';
import chroma from 'chroma-js';
import idbKeyval from 'idb-keyval';

const hue = jshue();
const SYNC_DELAY = 90; // Time between a sync call to the bridge for color changes

export default {
	name: 'app',
	data() {
		return {
			lights: [],
			configuredLights: [],
			calibrationLight: undefined,
			outlinePoints: [],
			hoveredLight: undefined,
			lastSync: new Date(),
			syncTimeout: null,
			bridgeAddress: '',
			connectStatus: 'disconnected',
			connectMessage: '',
			collectPointsInterval: null
		};
	},
	computed: {
		
	},
	
	watch: {
		
	},
	filters: {
		stringPos: ({x, y, z}) => `${x} ${y} ${z}`
	},
	
	
	created: async function () {
		
		// TODO: use saved bridge IP if it exists.
		let bridgeAddress = await idbKeyval.get('bridgeAddress');
		console.log(bridgeAddress);
		if(bridgeAddress !== undefined) {
			this.bridgeAddress = bridgeAddress;
			this.connectBridge();
			
		} else {
			return this.discoverBridge();
		}
	},
	
	
	methods: {
		discoverBridge: function () {
			this.connectStatus = 'connecting';
			return hue.discover().then(bridges => {
				console.log(bridges);
				if(bridges.length === 0) {
					console.log('No bridges found. :(');
					this.connectStatus = 'disconnected';
					this.connectMessage = 'No bridges found. Try entering the address manually.';
				}
				else {
					console.log('discovered a bridge!', bridges[0].internalipaddress);
					this.bridgeAddress = bridges[0].internalipaddress;
				}
			}).catch(e => {
				console.log('Error finding bridges', e);
			});
		},
		
		connectBridge: async function () {
			console.log('connectBridge');
			this.connectStatus = 'connecting';
			this.connectMessage = `Connecting to bridge @ ${this.bridgeAddress}, connecting…`;
			this.bridge = hue.bridge(this.bridgeAddress);
			this.hueUser = this.bridge.user('lampe-bash');
			let self = this;
			
			return new Promise(async (resolve, reject) => {
				
				let timeout = setTimeout(handleError, 5000);
				
				function handleError() {
					self.connectStatus = 'error';
					console.log('Error getting config from bridge');
					self.connectMessage = 'Error connecting to brige. Are you sure the IP-Address of your bridge is correct?';
					reject();
				}
				
				try {
					var config = await this.hueUser.getConfig();
					// Got config!
					console.log(config);
					this.connectStatus = 'connected';
					this.connectMessage = `Connected to bridge (${this.bridgeAddress})`;
					idbKeyval.set('bridgeAddress', this.bridgeAddress);
					this.pullLights();
					resolve();
				} catch (e) {
					console.log('catched error');
					console.log(e);
					handleError();
				} finally {
					clearTimeout(timeout);
				}
				
			});
			
		},
		
		resetConfiguration: function () {
			console.log('resetConfig');
			idbKeyval.delete('bridgeAddress');
			idbKeyval.delete('configuredLights');
			this.lights = [];
			this.configuredLights = [];
			this.calibrationLight = undefined;
			this.bridgeAddress = '';
			this.bridgeAddress = undefined;
			this.connectStatus = 'disconnected';
		},
		
		repositionAllBasedOnCalibrationLight: function () {
			for (let light of this.configuredLights) {
				if(light === this.calibrationLight) continue;
				light.position = new THREE.Vector3().addVectors(this.calibrationLight.position, light.relativePosition);
			}
			
		},
		
		pullLights: async function () {
			// Initially get all lights from indexedDB and Hue Bridge.
			
			let storedPromise = idbKeyval.get('configuredLights');
			let bridgePromise = this.hueUser.getLights();
			let [storedLights=[], bridgeLights] = await Promise.all([storedPromise, bridgePromise]);
			console.log(storedLights, bridgeLights);
			if(Object.keys(bridgeLights).length === 0) {
				console.error('No lights found @ configured bridge!');
				return;
			}
			
			// Merge Bridge light info into position light info
			for (let index in bridgeLights) {
				
				let light = bridgeLights[index];
				let storedLight = storedLights.find((light_) => light.uniqueid === light_.uniqueid);
				
				if(storedLight) {
					light = Object.assign(light, storedLight);
					this.configuredLights.push(light);
				} else {
					light.position = {};
				}
				light.number = parseInt(index);
				this.lights.push(light);
			}
			
			this.calibrationLight = this.configuredLights[0];
			this.repositionAllBasedOnCalibrationLight();
			
		},
		syncLights: function () {
			clearTimeout(this.syncTimeout);
			this.syncTimeout = null;
			this.lastSync = new Date();
			for (let light of this.configuredLights) {
				if(light.changed !== undefined && light.changed === true) {
					console.log();
					this.hueUser.setLightState(light.number, {sat: 255, bri: light.state.bri, hue: light.state.hue}).catch((err) => {
						console.log(err);
					});
					light.changed = false;
				}

			}
			
		},
		
		queueSyncLights: function () {
			
			// Check if a timeout to sync is already scheduled, if there is wait for it
			// otherwise try to sync lights now or schedule a timeout for soonish execution
			// console.log('quue sync lights');
			if(!this.syncTimeout) {
				// console.log('no timeout');
				let now = new Date();
				let diff = now - this.lastSync;
				if(diff >= SYNC_DELAY) {
					// Only set light state if 100ms have passed since last sync with bridge
					this.syncLights();
				} else {
					// Last update was less than 100ms ago, create a  recursive timeout instead
					this.syncTimeout = setTimeout(this.syncLights.bind(this), SYNC_DELAY - diff);
				}
			}
			
			
		},
		
		
		configureLight: function (evt, light) {
			console.log('set up', light);
			this.configureLightMode = true;
			this.lightToConfigure = light;
			console.log(this.lightToConfigure);
		},
		
		buttonDown: function (evt) {
			console.log('controller click');
			
			if(this.configureLightMode && this.lightToConfigure !== undefined) {
				// Set the lights position to controllers position
				this.outlinePoints = new THREE.Geometry();
				this.collectPointsInterval = setInterval(() => {
					this.addPoint(evt.target);
				}, 50);
			}
		},
		buttonUp: function (evt) {
			
			if((this.configureLightMode && this.lightToConfigure !== undefined && this.collectPointsInterval)) {
				
				clearInterval(this.collectPointsInterval);
				console.log('collected points', this.outlinePoints);
				// calculate center of outline
				// let center = new THREE.Vector3(0, 0, 0);
				// for (let point of this.outlinePoints) {
				// 	center.add(point);
				// }
				// center.divideScalar(this.outlinePoints.length);
				// console.log(center);
				
				this.outlinePoints.computeBoundingSphere();
				console.log('center:', this.outlinePoints.boundingSphere.center);
				console.log('radius', this.outlinePoints.boundingSphere.radius);
				
				this.lightToConfigure.position = this.outlinePoints.boundingSphere.center;
				this.lightToConfigure.radius = this.outlinePoints.boundingSphere.radius * 1.1;

				
				if(this.configuredLights.length === 0) {
					// if it is the first light to be configured
					// use it as the calibration point for all additional lights
					console.log('IS FIRST LIGHT');
					this.calibrationLight = this.lightToConfigure;
				}
				
				if (this.lightToConfigure === this.calibrationLight) {
					console.log('IS CALIBRATION LIGHT');

					if(this.configuredLights.length > 1 && this.calibrationMode) {
						this.repositionAllBasedOnCalibrationLight();
					} else {
						// Just set light 1 (calibration light) to new position
						// so we keep all other lights position but adjust their relative position
						// to calibration light.
						this.configuredLights.forEach(this.setRelativePosition);
					}
				}
				
				this.hueUser.setLightState(this.lightToConfigure.number, {alert: 'select'});
				
				
				// If light has not been configured yet, add it to the configuredLights list
				if(!this.configuredLights.some(light => light.number === this.lightToConfigure.number)) {
					this.lightToConfigure.changed = false;
					this.configuredLights.push(this.lightToConfigure);
				}
				
				console.log('configured lights');
				// save relative position to the calibrationLight for later sessions
				// used when calling recalibrate
				this.setRelativePosition(this.lightToConfigure);
				this.updateIDB();
				this.configureLightMode = false;
				this.lightToConfigure = undefined;
			}
		},
		
		addPoint: function (controller) {
			let {x, y, z} = controller.getAttribute('position');
			let controllerPos = new THREE.Vector3(x, y, z);
			let numPoints = this.outlinePoints.vertices.length;
			if(numPoints !== 0) {
				let dist = controllerPos.distanceTo(this.outlinePoints.vertices[numPoints-1]);
				console.log('distance', dist);
				// dont add point if too close or too far away to previous point
				// to prevent overly large array, respectively flaky position info from the controller
				if(dist < 0.01 || dist > 1.0) return;
			}
			this.outlinePoints.vertices.push(controllerPos);
			// this.outlinePoints.push(controllerPos);
			console.log(this.outlinePoints.vertices);
		},
		
		compressPoints: function () {
			
		},
		
		toggleLight: function (evt, light) {
			return this.hueUser.getLight(light.number).then(({state}) => {
				return this.hueUser.setLightState(light.number, {on: !state.on});
			});
		},
		axismove: function (evt, el) {
			// console.log(evt.detail.axis);
			// FIXME: for some reason there is always a 0,0 axis event triggered at the end
			// maybe open issue at aframe?
			if(evt.detail.axis[0] === 0 && evt.detail.axis[1] === 0) return;
			let axis = evt.detail.axis;
			let vec = new THREE.Vector2(axis[0], axis[1]);
			let angle = vec.angle() * 180/Math.PI;
			// console.log(angle);
			let [h, s, v] = chroma.hsv(angle, 0.9, 0.9).hsv();
			
			let hsb = {hue: Math.round(h * (65535 / 360)), sat: Math.round(s * 255), bri: Math.round(v * 255)};
						
			if(this.hoveredLight) {
				// console.log(intersected);
				this.hoveredLight.state.hue = hsb.hue;
				// console.log('changed',intersected.number,'to',intersected.state.hue);
				this.hoveredLight.changed = true;
				// intersected.state.sat = hsb.sat;
				// intersected.state.bri = hsb.bri;
				
				this.queueSyncLights(); // IDEA: Perhaps move this to a watcher that watches this.configuredLights
			}
			
		},
		
		hoverLight: async function (evt, light) {
			
			// let state = await this.hueUser.getLight(light.number);
			// console.log(evt.type);
			if(evt.type === 'mouseenter') {
				console.log('mouseenter');
				this.hoveredLight = light;
				light.previousColor = {
					hue: light.state.bri,
					sat: light.state.sat,
					bri: light.state.bri
				};
				// Create subtle hover effect by dimming up/down
				light.state.bri = light.state.bri <= 200 ? light.state.bri + 50 : light.state.bri - 50;
				light.changed = true;
				
			} else if (evt.type === 'mouseleave') {
				console.log('mouseleave');
				this.hoveredLight = undefined;
				// Restore previous light if not changed.
				if(!light.changed) { //FIXME: changed is reset/false when light changes...
					light.state.bri = light.previousColor.bri;
					light.changed = true;
				}
			}
			
			this.syncLights();
			
		},
		
		setRelativePosition: function(light) {
			light.relativePosition = new THREE.Vector3().subVectors(this.calibrationLight.position, light.position);
		},
		
		updateIDB: function() {
			
			idbKeyval.set('configuredLights', this.configuredLights);
		}
	}
};

// function hueGammaCorrection(value) {
// 	return (value > 0.04045) ? Math.pow((value + 0.055) / (1.0 + 0.055), 2.4) : (value / 12.92);
// }
//
// function hueReverseGammaCorrection(value) {
// 	return (value <= 0.0031308) ? 12.92 * value : (1.0 + 0.055) * Math.pow(value, (1.0 / 2.4)) - 0.055;
// }
//
//
//
// function hueGlToXY(rgb) {
// 	rgb = rgb.map(hueGammaCorrection);
// 	let [r, g, b] = rgb;
// 	let x = r * 0.664511 + g * 0.154324 + b * 0.162028;
// 	let y = r * 0.283881 + g * 0.668433 + b * 0.047685;
// 	let z = r * 0.000088 + g * 0.072310 + b * 0.986039;
// 	x = x / (x + y + z);
// 	y = y / (x + y + z);
// 	return [x,y];
// }
//
// function hueXYtoGl([x, y]) {
// 	let z =  1.0 - x - y;
//
// 	let y_ = 1.0;//brightness
// 	let x_ = (y / y_) * x;
// 	let z_ = (y_ / y) * z;
//
// 	let r =  x_ * 1.656492 - y_ * 0.354851 - z_ * 0.255038;
// 	let g = -x_ * 0.707196 + y_ * 1.655397 + z_ * 0.036152;
// 	let b =  x_ * 0.051713 - y_ * 0.121364 + z_ * 1.011530;
//
// 	return [r, g, b].map(hueReverseGammaCorrection);
// }





function addIndex(light, index) {
	light.index = index;
	return light;
}
</script>

<style>
a-scene {
	width: 400px;
	height: 400px;
}
.hidden {
	display: none;
}

#lightlist {
	display: flex;
	flex-direction: column;
}

.error {
	background-color: rgba(249, 60, 65, 0.5);
}

#connectBox {
	width: 20em;
	display: flex;
	flex-direction: column;
}

#discoverBridgeLink {
	color: blue;
	cursor: pointer;
}

#bridgeForm {
	width: 10px;
	display: flex;
	flex-direction: row;
}



</style>
