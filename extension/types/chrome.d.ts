declare namespace chrome {
  namespace webRequest {
    interface WebRequestDetailsBase {
      url: string;
      initiator?: string;
    }

    interface WebRequestBodyDetails extends WebRequestDetailsBase {
      requestBody?: { raw?: Array<{ bytes?: ArrayBuffer }> };
    }

    interface WebResponseDetails extends WebRequestDetailsBase {
      statusCode: number;
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
    interface WebRequestCompletedEvent {
      addListener(callback: (details: WebResponseDetails) => void, filter: RequestFilter): void;
    }
    const onBeforeRequest: WebRequestEvent;
    const onCompleted: WebRequestCompletedEvent;
  }

  namespace tabs {
    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
    }
    interface Tab {
      id?: number;
    }
    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function sendMessage(tabId: number, message: any): Promise<any>;
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
