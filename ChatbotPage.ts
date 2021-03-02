import { ipcRenderer } from 'electron';
import * as riot from 'riot';

import ChatbotWrap from './res/ChatbotWrap';

import TTVSTRenderer from '../../dist/dev.pakl.ttvst/renderer/TTVST';
declare var TTVST: TTVSTRenderer;
const { Settings, Broadcast } = TTVST;


let chatbotWrapCmpnt: any = null;

class ChatbotPage extends TTVST.ui.Page {
	
	contentComponent: riot.RiotComponent = null;
	contextResultListener: (e: Electron.IpcRendererEvent, v: string) => void = null;

	constructor() {
		super('Chatbot');

		ipcRenderer.send('app.ttvst.chatbot.registerFlows');

		this.onRightClick = this.onRightClick.bind(this);
		chatbotWrapCmpnt = riot.component<null, null>(ChatbotWrap);
	}

	get icon(): string {
		return 'ChatBot';
	}

	content(): HTMLElement {
		if(this.contentComponent === null) {
			this.contentComponent = chatbotWrapCmpnt(document.createElement('ChatbotWrap'));
		}

		return this.contentComponent.root;
	}

	open() {
		super.open();
		document.addEventListener('contextmenu', this.onRightClick);
	}

	close() {
		document.removeEventListener('contextmenu', this.onRightClick);
		if(this.contextResultListener !== null) {
			ipcRenderer.off('app.ttvst.chatbot.contextSelect', this.contextResultListener);
			this.contextResultListener = null;
		}
		super.close();
	}

	onRightClick(e: MouseEvent) {
		e.preventDefault();
		if(e.target instanceof Element) {
			if(e.target.tagName.toUpperCase() === 'INPUT' || e.target.tagName.toUpperCase() === 'TEXTAREA') {
				let input: HTMLInputElement = e.target as HTMLInputElement;
				const self = this;
				this.contextResultListener = (e: Electron.IpcRendererEvent, v: string) => {
					self.contextResultListener = null;
					if(v.length > 0) {
						v = '${' + v + '}';
						let val = input.value;
						let selStart = input.selectionStart;
						let selEnd = input.selectionEnd;
						if(selEnd < selStart) {
							selStart = selEnd;
							selEnd = input.selectionStart;
						}
						input.value = val.substring(0, selStart) + v + val.substring(selEnd);
						input.selectionStart = selStart;
						input.selectionEnd = selStart + v.length;

						var evt = document.createEvent("HTMLEvents");
						evt.initEvent("change", false, true);
						input.dispatchEvent(evt);
					}
				};
				ipcRenderer.once('app.ttvst.chatbot.contextSelect', this.contextResultListener);
				ipcRenderer.send('app.ttvst.chatbot.contextMenu', e.x, e.y, this.contentComponent.getMoreContextVars());
			}
		}
	}

}
export = ChatbotPage;