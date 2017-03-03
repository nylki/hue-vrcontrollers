import 'aframe';
import jsHue from './jshue';


var hue = jsHue();
var bridge = hue.bridge('192.168.2.17');
var user = bridge.user('lampe-bash');


user.getConfig().then(config => {console.log(config)}).catch((err) => {console.log(err);})

user.getLight(1).then((state) => {console.log(state);});
user.getLights().then((lights) => {console.log(lights);})
