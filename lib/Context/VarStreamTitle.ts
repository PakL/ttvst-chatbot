import VarInterface from './VarInterface';
import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;

class VarStreamTitle extends VarInterface {

	constructor() {
		super('StreamTitle', '');
	}

	async setTo(): Promise<void> {}

	async getValue(): Promise<string> {
		try {
			return await TTVST.BroadcastMain.instance.execute('app.ttvst.helix.getStream');
		} catch(e) {}
		return '';
	}

}
export = VarStreamTitle;