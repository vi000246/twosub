import { browser } from 'wxt/browser';
import type { Msg, MsgResult } from '../types/messages';

// Typed wrapper over browser.runtime messaging. content scripts call sendMsg;
// the background registers a single handler via onMsg.
export function sendMsg<T extends Msg['type']>(
  type: T,
  payload: Extract<Msg, { type: T }>['payload'],
): Promise<MsgResult[T]> {
  const msg = { v: 1, type, payload } as Msg;
  return browser.runtime.sendMessage(msg) as Promise<MsgResult[T]>;
}

export function onMsg(handler: (msg: Msg) => unknown): void {
  browser.runtime.onMessage.addListener((msg: unknown) => Promise.resolve(handler(msg as Msg)));
}
