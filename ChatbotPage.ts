import * as riot from 'riot';

import ChatbotWrap from './res/ChatbotWrap';

import TTVSTRenderer from '../../dist/dev.pakl.ttvst/renderer/TTVST';
declare var TTVST: TTVSTRenderer;
const { Settings, Broadcast } = TTVST;


let chatbotWrapCmpnt: any = null;

class ChatbotPage extends TTVST.ui.Page {
	
	contentComponent: riot.RiotComponent = null;

	constructor() {
		super('Chatbot');

		chatbotWrapCmpnt = riot.component<null, null>(ChatbotWrap);
	}

	get icon(): string {
		return 'Robot';
	}

	content(): HTMLElement {
		if(this.contentComponent === null) {
			this.contentComponent = chatbotWrapCmpnt(document.createElement('ChatbotWrap'));
		}

		return this.contentComponent.root;
	}

}
export = ChatbotPage;