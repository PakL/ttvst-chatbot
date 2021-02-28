import VarInterface from './VarInterface';
import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;

class VarStreamGame extends VarInterface {

	constructor() {
		super('StreamGame', '');
	}

	async setTo(): Promise<void> {}

	async getValue(): Promise<string> {
		try {
			return await TTVST.BroadcastMain.instance.execute('app.ttvst.helix.getGame');
		} catch(e) {}
		return '';
	}

}
export = VarStreamGame;