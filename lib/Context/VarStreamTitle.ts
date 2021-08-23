import VarInterface from './VarInterface';
import TTVSTMain from '../../../../dist/dev.pakl.ttvst/main/TTVSTMain';

declare var TTVST: TTVSTMain;

class VarStreamTitle extends VarInterface {

	constructor() {
		super('StreamTitle', '');
	}

	async setTo(): Promise<void> {}

	async getValue(index?: string): Promise<string> {
		try {
			return await TTVST.BroadcastMain.instance.execute('app.ttvst.helix.getStream', (typeof(index) === 'string' ? index : ''));
		} catch(e) {}
		return '';
	}

}
export = VarStreamTitle;