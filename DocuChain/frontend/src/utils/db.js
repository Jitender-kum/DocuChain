import Dexie from 'dexie';

export const db = new Dexie('DocuChainDB');

db.version(1).stores({
  chats: '++id, documentCid, role, text, timestamp'
});
