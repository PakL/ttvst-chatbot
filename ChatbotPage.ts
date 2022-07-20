import { ipcRenderer } from 'electron';
import * as riot from 'riot';

import Folder from './lib/Folder';
import Flow from './lib/Flow';
import GVar from './lib/GVar';

import ChatbotWrap, * as ChatbotWrapComp from './res/ChatbotWrap';

import TTVSTRenderer from '../../dist/dev.pakl.ttvst/renderer/TTVST';
declare var TTVST: TTVSTRenderer;
const { Settings, Broadcast } = TTVST;


let chatbotWrapCmpnt: any = null;

class ChatbotPage extends TTVST.ui.Page {
	
	contentComponent: ChatbotWrapComp.Component = null;
	contextResultListener: (e: Electron.IpcRendererEvent, v: string) => void = null;

	constructor() {
		super('Chatbot');

		ipcRenderer.send('app.ttvst.chatbot.registerFlows');

		this.onRightClick = this.onRightClick.bind(this);
		chatbotWrapCmpnt = riot.component(ChatbotWrap);
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

	static async exportFlow(flow: Flow): Promise<any> {
		if(flow === null) return null;

		let data = Object.assign({}, flow.data) as any;
		data.type = 'Flow';
		delete data.key;
		delete data.superior;
		delete data.path;
		return data;
	}

	static async exportFolder(folder: Folder): Promise<any> {
		if(folder === null) return null;

		let data = Object.assign({}, folder.data) as any;

		let subdata = [];
		let subfolders = await Folder.getByIndex('superior', data.key);
		for(let i = 0; i < subfolders.length; i++) {
			subdata.push(await ChatbotPage.exportFolder(subfolders[i]));
		}
		let subflows = await Flow.getByIndex('superior', data.key);
		for(let i = 0; i < subflows.length; i++) {
			subdata.push(await ChatbotPage.exportFlow(subflows[i]));
		}

		data.type = 'Folder';
		data.children = subdata;
		delete data.key;
		delete data.superior;
		delete data.path;
		return data;
	}

	close() {
		document.removeEventListener('contextmenu', this.onRightClick);
		if(this.contextResultListener !== null) {
			ipcRenderer.off('app.ttvst.chatbot.contextSelect', this.contextResultListener);
			this.contextResultListener = null;
		}
		super.close();

		const self = this;
		new Promise(async () => {
			let data = [];
			let folders = await Folder.getByIndex('superior', -1);
			for(let i = 0; i < folders.length; i++) {
				data.push(await ChatbotPage.exportFolder(folders[i]));
			}
			let flows = await Flow.getByIndex('superior', -1);
			for(let i = 0; i < flows.length; i++) {
				data.push(await ChatbotPage.exportFlow(flows[i]));
			}
			let gvars = await GVar.getAll(null);
			for(let j = 0; j < gvars.length; j++) {
				data.push({ type: 'GVar', name: gvars[j].name, value: gvars[j].value });
			}
			await ipcRenderer.invoke('app.ttvst.chatbot.backupdata', JSON.stringify({ identifier: 'ttvst_chatbot', version: '2.1.0', data }));
		});
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
						if(val.substr(selStart-1, 1) == '[' && val.substr(selEnd, 1) == ']') {
							v = v.substr(2, v.length-3);
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