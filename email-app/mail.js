'use strict';
// All mail-server communication lives here (main process only).
// IMAP via imapflow for reading, SMTP via nodemailer for sending.

const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const MailComposer = require('nodemailer/lib/mail-composer');
const { simpleParser } = require('mailparser');
const { EventEmitter } = require('events');

const PAGE_SIZE = 50;

const PRESETS = {
  gmail: {
    label: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 465, secure: true },
    savesSentAutomatically: true,
    help: 'Use a Google "App password" (Google Account → Security → 2-Step Verification → App passwords), not your normal password.'
  },
  yahoo: {
    label: 'Yahoo',
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    help: 'Use a Yahoo "App password" (Account security → Generate app password).'
  },
  icloud: {
    label: 'iCloud',
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false },
    help: 'Use an app-specific password from appleid.apple.com → Sign-In and Security.'
  },
  outlook: {
    label: 'Outlook / Hotmail',
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp-mail.outlook.com', port: 587, secure: false },
    help: 'Microsoft blocks password sign-in for most personal Outlook.com accounts. This may be refused; work/school accounts with IMAP enabled usually work.'
  },
  custom: {
    label: 'Other (IMAP/SMTP)',
    imap: { host: '', port: 993, secure: true },
    smtp: { host: '', port: 465, secure: true },
    help: 'Enter the IMAP and SMTP server details from your email provider.'
  }
};

function friendlyError(err) {
  const msg = (err && (err.responseText || err.response || err.message)) || String(err);
  if (err && err.serverResponseCode === 'UNAVAILABLE') return 'The mail server is temporarily unavailable. Try again in a minute.';
  if (/Unexpected close|ECONNRESET/i.test(msg)) return 'The mail server closed the connection. Check the server settings (host, port, SSL) and try again.';
  if (err && err.authenticationFailed) return 'Sign-in failed: wrong email or password. Many providers need an app password.';
  if (/Invalid login|AUTHENTICATIONFAILED|535|authentication/i.test(msg)) return 'Sign-in failed: wrong email or password. Many providers need an app password.';
  if (err && (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN')) return `Server not found (${err.hostname || 'check the host name'}).`;
  if (err && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNECTION')) return 'Could not connect to the mail server. Check host, port and your internet connection.';
  return msg;
}

function envelopeAddr(list) {
  return (list || []).map(a => ({ name: a.name || '', address: a.address || '' }));
}

function summarize(msg) {
  const env = msg.envelope || {};
  return {
    uid: msg.uid,
    subject: env.subject || '(no subject)',
    from: envelopeAddr(env.from),
    to: envelopeAddr(env.to),
    date: (env.date || msg.internalDate || new Date()).toISOString(),
    seen: msg.flags ? msg.flags.has('\\Seen') : false,
    flagged: msg.flags ? msg.flags.has('\\Flagged') : false,
    hasAttachments: hasAttachment(msg.bodyStructure)
  };
}

function hasAttachment(node) {
  if (!node) return false;
  if (node.disposition === 'attachment') return true;
  return (node.childNodes || []).some(hasAttachment);
}

class MailClient extends EventEmitter {
  constructor(account) {
    super();
    this.account = account;
    this.imap = null;
    this.connecting = null;
    this.folders = [];
    this.attachmentCache = new Map(); // key `${folder}:${uid}:${i}` -> {filename, content}
  }

  imapOptions() {
    const a = this.account;
    return {
      host: a.imap.host, port: Number(a.imap.port), secure: !!a.imap.secure,
      auth: { user: a.user || a.email, pass: a.password },
      logger: false, emitLogs: false
    };
  }

  smtpTransport() {
    const a = this.account;
    return nodemailer.createTransport({
      host: a.smtp.host, port: Number(a.smtp.port), secure: !!a.smtp.secure,
      auth: { user: a.user || a.email, pass: a.password }
    });
  }

  async connect() {
    if (this.imap && this.imap.usable) return this.imap;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new ImapFlow(this.imapOptions());
      client.on('error', () => {}); // handled through 'close'
      client.on('close', () => { if (this.imap === client) this.imap = null; });
      client.on('exists', ev => this.emit('new-mail', { folder: ev.path, count: ev.count }));
      client.on('flags', ev => this.emit('flags', { folder: ev.path, uid: ev.uid }));
      await client.connect();
      this.imap = client;
      return client;
    })();
    try { return await this.connecting; } finally { this.connecting = null; }
  }

  async close() {
    const c = this.imap; this.imap = null;
    if (c) { try { await c.logout(); } catch { c.close(); } }
  }

  // Verify both IMAP and SMTP work with these credentials.
  static async verify(account) {
    const m = new MailClient(account);
    try {
      await m.connect();
      await m.smtpTransport().verify();
    } catch (err) {
      throw new Error(friendlyError(err));
    } finally {
      await m.close();
    }
  }

  async withMailbox(path, fn) {
    const client = await this.connect();
    const lock = await client.getMailboxLock(path);
    try { return await fn(client); } finally { lock.release(); }
  }

  async listFolders() {
    const client = await this.connect();
    const list = await client.list({ statusQuery: { unseen: true, messages: true } });
    const order = { '\\Inbox': 0, '\\Flagged': 1, '\\Drafts': 2, '\\Sent': 3, '\\Archive': 4, '\\Junk': 5, '\\Trash': 6 };
    this.folders = list
      .filter(f => !(f.flags && f.flags.has('\\Noselect')))
      .map(f => ({
        path: f.path,
        name: f.path.toUpperCase() === 'INBOX' ? 'Inbox' : f.name,
        specialUse: f.path.toUpperCase() === 'INBOX' ? '\\Inbox' : (f.specialUse || null),
        unseen: f.status ? f.status.unseen || 0 : 0,
        total: f.status ? f.status.messages || 0 : 0
      }))
      .sort((a, b) => {
        const oa = a.specialUse in order ? order[a.specialUse] : 50;
        const ob = b.specialUse in order ? order[b.specialUse] : 50;
        return oa - ob || a.path.localeCompare(b.path);
      });
    return this.folders;
  }

  folderByUse(use) {
    const f = this.folders.find(x => x.specialUse === use);
    if (f) return f.path;
    const names = { '\\Trash': /^(trash|deleted( items| messages)?|bin)$/i, '\\Sent': /^(sent( items| mail| messages)?)$/i, '\\Archive': /^archive$/i };
    const g = names[use] && this.folders.find(x => names[use].test(x.name));
    return g ? g.path : null;
  }

  async listMessages(folder, page = 0) {
    return this.withMailbox(folder, async client => {
      const total = client.mailbox.exists;
      if (!total) return { total: 0, page, hasMore: false, messages: [] };
      const end = total - page * PAGE_SIZE;
      if (end < 1) return { total, page, hasMore: false, messages: [] };
      const start = Math.max(1, end - PAGE_SIZE + 1);
      const messages = [];
      for await (const msg of client.fetch(`${start}:${end}`, { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true })) {
        messages.push(summarize(msg));
      }
      messages.sort((a, b) => b.uid - a.uid);
      return { total, page, hasMore: start > 1, messages };
    });
  }

  async search(folder, query) {
    return this.withMailbox(folder, async client => {
      const q = String(query || '').trim();
      if (!q) return { total: 0, page: 0, hasMore: false, messages: [] };
      const uids = await client.search({ or: [{ subject: q }, { from: q }, { to: q }, { body: q }] }, { uid: true }) || [];
      const pick = uids.sort((a, b) => b - a).slice(0, 100);
      const messages = [];
      if (pick.length) {
        for await (const msg of client.fetch(pick.join(','), { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true }, { uid: true })) {
          messages.push(summarize(msg));
        }
      }
      messages.sort((a, b) => b.uid - a.uid);
      return { total: uids.length, page: 0, hasMore: false, messages };
    });
  }

  async getMessage(folder, uid) {
    return this.withMailbox(folder, async client => {
      const msg = await client.fetchOne(String(uid), { uid: true, source: true, flags: true }, { uid: true });
      if (!msg) throw new Error('Message not found (it may have been moved or deleted).');
      const parsed = await simpleParser(msg.source);
      if (!msg.flags || !msg.flags.has('\\Seen')) {
        await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      }
      const attachments = [];
      for (const [i, a] of (parsed.attachments || []).entries()) {
        if (a.contentDisposition === 'inline' && a.related) continue; // embedded image already in html
        this.attachmentCache.set(`${folder}:${uid}:${i}`, { filename: a.filename || `attachment-${i + 1}`, content: a.content });
        attachments.push({ index: i, filename: a.filename || `attachment-${i + 1}`, size: a.size, contentType: a.contentType });
      }
      const addr = v => (v && v.value ? v.value.map(x => ({ name: x.name || '', address: x.address || '' })) : []);
      return {
        uid, folder,
        subject: parsed.subject || '(no subject)',
        from: addr(parsed.from), to: addr(parsed.to), cc: addr(parsed.cc), replyTo: addr(parsed.replyTo),
        date: (parsed.date || new Date()).toISOString(),
        messageId: parsed.messageId || null,
        references: Array.isArray(parsed.references) ? parsed.references : (parsed.references ? [parsed.references] : []),
        html: parsed.html || null,
        text: parsed.text || '',
        flagged: msg.flags ? msg.flags.has('\\Flagged') : false,
        attachments
      };
    });
  }

  getAttachment(folder, uid, index) {
    return this.attachmentCache.get(`${folder}:${uid}:${index}`) || null;
  }

  async setFlag(folder, uid, flag, on) {
    return this.withMailbox(folder, async client => {
      if (on) await client.messageFlagsAdd(String(uid), [flag], { uid: true });
      else await client.messageFlagsRemove(String(uid), [flag], { uid: true });
      return true;
    });
  }

  async move(folder, uid, target) {
    return this.withMailbox(folder, async client => {
      await client.messageMove(String(uid), target, { uid: true });
      return true;
    });
  }

  async remove(folder, uid) {
    const trash = this.folderByUse('\\Trash');
    if (trash && trash !== folder) return this.move(folder, uid, trash);
    return this.withMailbox(folder, async client => {
      await client.messageDelete(String(uid), { uid: true });
      return true;
    });
  }

  async archive(folder, uid) {
    const archive = this.folderByUse('\\Archive') || this.folderByUse('\\All');
    if (!archive) throw new Error('This account has no Archive folder.');
    if (archive === folder) return true;
    return this.move(folder, uid, archive);
  }

  async send(mail) {
    const a = this.account;
    const message = {
      from: a.name ? { name: a.name, address: a.email } : a.email,
      to: mail.to, cc: mail.cc || undefined, bcc: mail.bcc || undefined,
      subject: mail.subject || '',
      text: mail.text || '',
      inReplyTo: mail.inReplyTo || undefined,
      references: mail.references && mail.references.length ? mail.references : undefined,
      attachments: (mail.attachments || []).map(p => ({ path: p }))
    };
    let raw;
    try {
      raw = await new MailComposer(message).compile().build();
    } catch (err) {
      throw new Error('Could not read an attachment: ' + err.message);
    }
    const transport = this.smtpTransport();
    try {
      await transport.sendMail({ envelope: {
        from: a.email,
        to: [].concat(splitAddrs(mail.to), splitAddrs(mail.cc), splitAddrs(mail.bcc))
      }, raw });
    } catch (err) {
      throw new Error('Sending failed: ' + friendlyError(err));
    } finally {
      transport.close();
    }
    // Keep a copy in Sent (Gmail does this on its own).
    if (!a.savesSentAutomatically) {
      const sent = this.folderByUse('\\Sent');
      if (sent) {
        try { const client = await this.connect(); await client.append(sent, raw, ['\\Seen']); } catch { /* sent anyway */ }
      }
    }
    return true;
  }

  async saveDraft(mail) {
    const drafts = this.folderByUse('\\Drafts');
    if (!drafts) throw new Error('This account has no Drafts folder.');
    const a = this.account;
    const raw = await new MailComposer({
      from: a.name ? { name: a.name, address: a.email } : a.email,
      to: mail.to || undefined, cc: mail.cc || undefined, bcc: mail.bcc || undefined,
      subject: mail.subject || '', text: mail.text || ''
    }).compile().build();
    const client = await this.connect();
    await client.append(drafts, raw, ['\\Draft', '\\Seen']);
    return true;
  }
}

function splitAddrs(s) {
  if (!s) return [];
  return String(s).split(/[,;]/).map(x => {
    const m = x.match(/<([^>]+)>/);
    return (m ? m[1] : x).trim();
  }).filter(Boolean);
}

module.exports = { MailClient, PRESETS, friendlyError, splitAddrs, PAGE_SIZE };
