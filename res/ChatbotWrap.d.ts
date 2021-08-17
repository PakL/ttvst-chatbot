import * as riot from 'riot';

export declare interface ChatbotWrapProps {
}
export declare interface ChatbotWrapState {
}
export declare interface Component<Props = ChatbotWrapProps, State = ChatbotWrapState> extends riot.RiotComponent<Props, State> {
	getMoreContextVars: () => Array<{ name: string, type: 'string'|'number'|'array'|'object'|'boolean' }>;
}

declare var RiotElement: riot.RiotComponentWrapper<Component>;
export default RiotElement;