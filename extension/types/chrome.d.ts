declare namespace chrome {
  namespace webRequest {
    interface WebRequestBodyDetails {
      url: string;
      requestBody?: { raw?: Array<{ bytes?: ArrayBuffer }> };
    }
    interface RequestFilter {
      urls: string[];
    }
    type OnBeforeRequestOptions = Array<'requestBody'>;
    interface WebRequestEvent {
      addListener(
        callback: (details: WebRequestBodyDetails) => void,
        filter: RequestFilter,
        extraInfoSpec?: OnBeforeRequestOptions,
      ): void;
    }
    const onBeforeRequest: WebRequestEvent;
  }

  namespace tabs {
    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
    }
    interface Tab {
      id?: number;
      url?: string;
    }
    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function sendMessage(tabId: number, message: any): Promise<any>;
    function update(tabId: number, updateProperties: { url?: string }): Promise<Tab>;
  }

  namespace runtime {
    interface MessageSender {}
    type SendResponse = (response?: any) => void;
    interface OnMessageEvent {
      addListener(
        callback: (message: any, sender: MessageSender, sendResponse: SendResponse) => void,
      ): void;
    }
    const onMessage: OnMessageEvent;
    function sendMessage(message: any): Promise<any>;
  }

  namespace storage {
    namespace local {
      function get(keys: string[] | Record<string, unknown>): Promise<Record<string, any>>;
      function set(items: Record<string, any>): Promise<void>;
    }
  }
}
