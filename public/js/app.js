import { MobileRouter } from './mobile_router.js';

// LOCAL STORAGE PERSISTENCE MANAGER CLASS
export class LocalStorageManager {
  static KEYS = {
    CONVERSATIONS: 'ble_mesh_conversations',
    AI_HISTORY: 'ble_mesh_ai_history',
    MESSAGES_CACHE: 'ble_mesh_messages_cache',
    THEME: 'ble_mesh_theme'
  };

  static saveConversations(conversations) {
    try {
      const dataToSave = conversations.map(c => ({
        id: c.id,
        name: c.name,
        isAi: c.isAi,
        icon: c.icon,
        status: c.status,
        isPinned: c.isPinned,
        isArchived: c.isArchived,
        lastActivityTimestamp: c.lastActivityTimestamp,
        lastMessage: c.lastMessage,
        time: c.time,
        unreadCount: c.unreadCount,
        messages: c.messages || []
      }));
      localStorage.setItem(LocalStorageManager.KEYS.CONVERSATIONS, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Failed to save conversations to localStorage:', e);
    }
  }

  static loadConversations() {
    try {
      const saved = localStorage.getItem(LocalStorageManager.KEYS.CONVERSATIONS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load conversations from localStorage:', e);
    }
    return null;
  }

  static saveAiHistory(aiMessages) {
    try {
      localStorage.setItem(LocalStorageManager.KEYS.AI_HISTORY, JSON.stringify(aiMessages));
    } catch (e) {
      console.warn('Failed to save AI history to localStorage:', e);
    }
  }

  static loadAiHistory() {
    try {
      const saved = localStorage.getItem(LocalStorageManager.KEYS.AI_HISTORY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load AI history from localStorage:', e);
    }
    return null;
  }

  static cacheMessages(chatId, messages) {
    try {
      const existing = JSON.parse(localStorage.getItem(LocalStorageManager.KEYS.MESSAGES_CACHE) || '{}');
      existing[chatId] = messages;
      localStorage.setItem(LocalStorageManager.KEYS.MESSAGES_CACHE, JSON.stringify(existing));
    } catch (e) {
      console.warn(`Failed to cache messages for [${chatId}]:`, e);
    }
  }

  static loadCachedMessages(chatId) {
    try {
      const existing = JSON.parse(localStorage.getItem(LocalStorageManager.KEYS.MESSAGES_CACHE) || '{}');
      return existing[chatId] || null;
    } catch (e) {
      return null;
    }
  }

  static saveTheme(theme) {
    try { localStorage.setItem(LocalStorageManager.KEYS.THEME, theme); } catch (e) {}
  }

  static loadTheme() {
    try { return localStorage.getItem(LocalStorageManager.KEYS.THEME) || 'dark'; } catch (e) { return 'dark'; }
  }

  static clearAllStorage() {
    try {
      localStorage.removeItem(LocalStorageManager.KEYS.CONVERSATIONS);
      localStorage.removeItem(LocalStorageManager.KEYS.AI_HISTORY);
      localStorage.removeItem(LocalStorageManager.KEYS.MESSAGES_CACHE);
      localStorage.removeItem(LocalStorageManager.KEYS.THEME);
      console.log('Local Storage successfully cleared.');
      return true;
    } catch (e) {
      console.error('Error clearing local storage:', e);
      return false;
    }
  }
}

export class NotificationManager {
  constructor(containerId = 'notificationStack') {
    if (typeof document !== 'undefined') {
      this.container = document.getElementById(containerId);
    }
  }

  showNotification(options = {}) {
    if (!this.container || typeof document === 'undefined') return;

    const {
      icon = '🔔',
      title = 'System Notification',
      text = '',
      type = 'info',
      durationMs = 4000
    } = options;

    const card = document.createElement('div');
    card.className = `notification-card ${type}`;
    card.innerHTML = `
      <div class="notif-icon">${icon}</div>
      <div class="notif-body">
        <div class="notif-title">${title}</div>
        <div class="notif-text">${text}</div>
      </div>
      <button class="notif-close" aria-label="Close notification">✕</button>
    `;

    const closeBtn = card.querySelector('.notif-close');
    const dismiss = () => { if (card.parentNode) card.parentNode.removeChild(card); };

    closeBtn.addEventListener('click', dismiss);
    this.container.appendChild(card);

    if (durationMs > 0) setTimeout(dismiss, durationMs);
  }

  notifyNewMessage(sender, text) {
    this.showNotification({ icon: '💬', title: `New Message from ${sender}`, text, type: 'notif-new-msg' });
  }

  notifyAiResponse(source, answer) {
    this.showNotification({ icon: '🤖', title: `AI Response Ready (${source || 'Edge RAG'})`, text: answer, type: 'notif-ai-resp' });
  }

  notifyDeliveryFailure(msgId, reason = 'Destination unreachable') {
    this.showNotification({ icon: '⚠️', title: 'Message Delivery Failed', text: `Packet [${msgId}]: ${reason}`, type: 'notif-fail', durationMs: 5000 });
  }

  notifyGatewayUnavailable(gatewayId = 'Gateway C1') {
    this.showNotification({ icon: '⚡', title: 'Gateway Unavailable', text: `${gatewayId} is offline or RF jammed. Switched to Edge RAG.`, type: 'notif-gw-unavail', durationMs: 5000 });
  }

  notifyMeshDisconnected(reason = 'BLE radio disabled or 0 active peers') {
    this.showNotification({ icon: '📡', title: 'Bluetooth Mesh Disconnected', text: `Mesh connection lost: ${reason}`, type: 'notif-mesh-disc', durationMs: 6000 });
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const router = new MobileRouter({ defaultScreen: 'chats' });
    router.init();

    const notifManager = new NotificationManager('notificationStack');

    const chkDarkTheme = document.getElementById('chkDarkTheme');
    const savedTheme = LocalStorageManager.loadTheme();
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      if (chkDarkTheme) chkDarkTheme.checked = false;
    } else {
      document.body.classList.remove('light-theme');
      if (chkDarkTheme) chkDarkTheme.checked = true;
    }

    if (chkDarkTheme) {
      chkDarkTheme.addEventListener('change', () => {
        if (chkDarkTheme.checked) {
          document.body.classList.remove('light-theme');
          LocalStorageManager.saveTheme('dark');
        } else {
          document.body.classList.add('light-theme');
          LocalStorageManager.saveTheme('light');
        }
      });
    }

    let conversations = LocalStorageManager.loadConversations();
    if (!conversations) {
      const defaultAiHistory = LocalStorageManager.loadAiHistory() || [
        { id: 'm1', sender: 'AI Assistant', text: 'Emergency AI Assistant initialized offline over Bluetooth Mesh.', time: '13:40', isOutgoing: false, routing: 'Edge Local RAG', gateway: 'Gateway C1' },
        { id: 'm2', sender: 'AI Assistant', text: 'Emergency SOP triage instructions available. How can I assist?', time: '13:45', isOutgoing: false, routing: 'Edge Local RAG', gateway: 'Gateway C1' }
      ];

      conversations = [
        {
          id: 'chat-ai-assistant',
          name: 'Emergency AI Assistant',
          isAi: true,
          icon: '🤖',
          status: 'online',
          isPinned: true,
          isArchived: false,
          lastActivityTimestamp: Date.now() - 300000,
          lastMessage: defaultAiHistory.length > 0 ? defaultAiHistory[defaultAiHistory.length - 1].text : 'Emergency AI Assistant Ready',
          time: '13:45',
          unreadCount: 2,
          messages: defaultAiHistory
        },
        {
          id: 'chat-node-b1',
          name: 'Node B1 - Rescue Relay',
          isAi: false,
          icon: '📡',
          status: 'online',
          isPinned: true,
          isArchived: false,
          lastActivityTimestamp: Date.now() - 600000,
          lastMessage: 'Relay B1 active in District 4. Mesh signal clear.',
          time: '13:40',
          unreadCount: 0,
          messages: [
            { id: 'm3', sender: 'Node B1', text: 'Relay B1 active in District 4. Mesh signal clear.', time: '13:40', isOutgoing: false, status: 'read' },
            { id: 'm4', sender: 'You', text: 'Confirmed, standing by for updates.', time: '13:42', isOutgoing: true, status: 'read' }
          ]
        },
        {
          id: 'chat-node-b2',
          name: 'Node B2 - Medical Response',
          isAi: false,
          icon: '🚑',
          status: 'relay',
          isPinned: false,
          isArchived: false,
          lastActivityTimestamp: Date.now() - 1800000,
          lastMessage: 'First aid supplies requested at Block 2 shelter.',
          time: '13:15',
          unreadCount: 1,
          messages: [
            { id: 'm5', sender: 'Node B2', text: 'First aid supplies requested at Block 2 shelter.', time: '13:15', isOutgoing: false, status: 'delivered' }
          ]
        },
        {
          id: 'chat-gateway-c1',
          name: 'Gateway C1 - Primary Node',
          isAi: false,
          icon: '⚡',
          status: 'online',
          isPinned: false,
          isArchived: false,
          lastActivityTimestamp: Date.now() - 3600000,
          lastMessage: '3000ms Heartbeat beacon online (Score: 69.25).',
          time: '12:50',
          unreadCount: 0,
          messages: [
            { id: 'm6', sender: 'Gateway C1', text: '3000ms Heartbeat beacon online (Score: 69.25).', time: '12:50', isOutgoing: false, status: 'read' }
          ]
        }
      ];

      LocalStorageManager.saveConversations(conversations);
    }

    let contacts = [
      { id: 'node-b1', name: 'Node B1 - Rescue Relay', role: 'Mesh Relay', rssi: '-55 dBm', battery: '88%', hops: 1, status: 'online' },
      { id: 'node-b2', name: 'Node B2 - Medical Response', role: 'Medical Team', rssi: '-68 dBm', battery: '72%', hops: 2, status: 'relay' },
      { id: 'gateway-c1', name: 'Gateway C1 - Primary', role: 'Primary Gateway', rssi: '-50 dBm', battery: '92%', hops: 1, status: 'online' },
      { id: 'gateway-c2', name: 'Gateway C2 - Secondary', role: 'Failover Gateway', rssi: '-75 dBm', battery: '65%', hops: 2, status: 'offline' }
    ];

    let activeChatId = null;
    let currentFilter = 'all';

    const conversationList = document.getElementById('conversationList');
    const contactsList = document.getElementById('contactsList');
    const inputSearchChats = document.getElementById('inputSearchChats');
    const inputSearchContacts = document.getElementById('inputSearchContacts');
    const navUnreadTotal = document.getElementById('navUnreadTotal');
    const filterChips = document.querySelectorAll('.filter-chips .chip');
    const toastNotification = document.getElementById('toastNotification');

    const aiProcessingBox = document.getElementById('aiProcessingBox');
    const aiChatThread = document.getElementById('aiChatThread');
    const inputAiQuery = document.getElementById('inputAiQuery');
    const btnSendAiQuery = document.getElementById('btnSendAiQuery');
    const charCountAi = document.getElementById('charCountAi');
    const valMsgAi = document.getElementById('valMsgAi');
    const shortcutBtns = document.querySelectorAll('.shortcut-btn');

    // EPIC 8: MOBILE DIAGNOSTICS SCREEN ELEMENTS
    const diagPacketLoss = document.getElementById('diagPacketLoss');
    const diagRssi = document.getElementById('diagRssi');
    const diagGateway = document.getElementById('diagGateway');
    const diagLatency = document.getElementById('diagLatency');
    const btnPingGateway = document.getElementById('btnPingGateway');
    const btnSwitchC1 = document.getElementById('btnSwitchC1');
    const btnSwitchC2 = document.getElementById('btnSwitchC2');
    const btnRefreshDiagnostics = document.getElementById('btnRefreshDiagnostics');
    const lblPingResult = document.getElementById('lblPingResult');
    const meshPathTrace = document.getElementById('meshPathTrace');
    const aiRoutingHistoryList = document.getElementById('aiRoutingHistoryList');

    const btnClearAllLocalStorage = document.getElementById('btnClearAllLocalStorage');

    const btnTestNotifNewMsg = document.getElementById('btnTestNotifNewMsg');
    const btnTestNotifAiResp = document.getElementById('btnTestNotifAiResp');
    const btnTestNotifFail = document.getElementById('btnTestNotifFail');
    const btnTestNotifGwUnavail = document.getElementById('btnTestNotifGwUnavail');
    const btnTestNotifMeshDisc = document.getElementById('btnTestNotifMeshDisc');

    const chatOverlay = document.getElementById('chatOverlay');
    const btnCloseOverlay = document.getElementById('btnCloseOverlay');
    const overlayChatTitle = document.getElementById('overlayChatTitle');
    const overlayChatSub = document.getElementById('overlayChatSub');
    const overlayChatTypeBadge = document.getElementById('overlayChatTypeBadge');
    const overlayChatThread = document.getElementById('overlayChatThread');
    const inputOverlayMessage = document.getElementById('inputOverlayMessage');
    const btnSendOverlayMessage = document.getElementById('btnSendOverlayMessage');
    const charCountOverlay = document.getElementById('charCountOverlay');
    const valMsgOverlay = document.getElementById('valMsgOverlay');
    const btnSimulateFail = document.getElementById('btnSimulateFail');

    const btnHeaderRename = document.getElementById('btnHeaderRename');
    const btnHeaderPin = document.getElementById('btnHeaderPin');
    const btnHeaderArchive = document.getElementById('btnHeaderArchive');

    const renameModal = document.getElementById('renameModal');
    const inputRenameTitle = document.getElementById('inputRenameTitle');
    const btnSaveRename = document.getElementById('btnSaveRename');
    const btnCloseRename = document.getElementById('btnCloseRename');

    const newChatModal = document.getElementById('newChatModal');
    const btnNewChat = document.getElementById('btnNewChat');
    const btnAskAi = document.getElementById('btnAskAi');
    const modalStartAi = document.getElementById('modalStartAi');
    const modalStartP2p = document.getElementById('modalStartP2p');
    const modalClose = document.getElementById('modalClose');
    const inputNewCustomChat = document.getElementById('inputNewCustomChat');
    const btnCreateCustomChat = document.getElementById('btnCreateCustomChat');

    function showToast(msg) {
      if (!toastNotification) return;
      toastNotification.textContent = msg;
      toastNotification.classList.remove('hidden');
      setTimeout(() => toastNotification.classList.add('hidden'), 2500);
    }

    function scrollToBottom(container) {
      if (container) setTimeout(() => { container.scrollTop = container.scrollHeight; }, 50);
    }

    function setupComposer(textarea, sendBtn, charCountEl, valMsgEl) {
      if (!textarea || !sendBtn) return;
      function validate() {
        const text = textarea.value;
        const trimmed = text.trim();
        const length = text.length;

        if (charCountEl) {
          charCountEl.textContent = length;
          const parent = charCountEl.parentElement;
          if (length > 450) { parent.classList.add('error-limit'); parent.classList.remove('warning-limit'); }
          else if (length > 400) { parent.classList.add('warning-limit'); parent.classList.remove('error-limit'); }
          else { parent.classList.remove('warning-limit', 'error-limit'); }
        }

        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';

        if (trimmed.length === 0) { sendBtn.disabled = true; if (valMsgEl) valMsgEl.classList.add('hidden'); }
        else { sendBtn.disabled = false; if (valMsgEl) valMsgEl.classList.add('hidden'); }
      }
      textarea.addEventListener('input', validate);
      validate();
    }

    setupComposer(inputAiQuery, btnSendAiQuery, charCountAi, valMsgAi);
    setupComposer(inputOverlayMessage, btnSendOverlayMessage, charCountOverlay, valMsgOverlay);

    // EPIC 8: FETCH AND RENDER DIAGNOSTICS SCREEN
    async function loadDiagnosticsData() {
      try {
        const res = await fetch('/api/diagnostics/summary');
        const data = await res.json();

        if (diagPacketLoss) diagPacketLoss.textContent = data.packetLoss || '2%';
        if (diagRssi) diagRssi.textContent = data.rssi || '-67 dBm';
        if (diagGateway) diagGateway.textContent = data.gateway || 'C2';
        if (diagLatency) diagLatency.textContent = data.latency || '83 ms';

        // Render Mesh Path Trace
        if (meshPathTrace && data.pathTrace && data.pathTrace.path) {
          meshPathTrace.innerHTML = '';
          data.pathTrace.path.forEach(hop => {
            const item = document.createElement('div');
            item.className = 'trace-hop-item';
            item.innerHTML = `
              <div class="trace-hop-left">
                <span class="trace-hop-badge">Hop ${hop.hop}</span>
                <span>${hop.node}</span>
              </div>
              <div class="trace-hop-right">${hop.rssi} • ${hop.delay}</div>
            `;
            meshPathTrace.appendChild(item);
          });
        }

        // Render AI Routing History
        if (aiRoutingHistoryList && data.routingLogs) {
          aiRoutingHistoryList.innerHTML = '';
          data.routingLogs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
              <div class="log-query" title="${log.query}">${log.query}</div>
              <div class="log-meta">
                <span class="badge-routing">${log.decision}</span>
                <span style="font-family:var(--font-mono); color:var(--text-muted);">${log.gateway} (${log.latency})</span>
              </div>
            `;
            aiRoutingHistoryList.appendChild(item);
          });
        }

      } catch (err) {
        console.warn('Failed to load diagnostics data:', err);
      }
    }

    if (btnRefreshDiagnostics) btnRefreshDiagnostics.addEventListener('click', loadDiagnosticsData);

    if (btnPingGateway) {
      btnPingGateway.addEventListener('click', async () => {
        try {
          const targetGw = diagGateway ? diagGateway.textContent : 'C2';
          const res = await fetch('/api/diagnostics/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gatewayId: targetGw })
          });
          const data = await res.json();
          if (lblPingResult) lblPingResult.textContent = `Ping Result: ${data.latencyMs} • Gateway ${targetGw} ${data.status}`;
          showToast(`⚡ Ping: ${data.latencyMs} (${targetGw})`);
          loadDiagnosticsData();
        } catch (err) {
          showToast('⚠️ Ping failed');
        }
      });
    }

    async function switchActiveGateway(targetGw) {
      try {
        const res = await fetch('/api/diagnostics/switch-gateway', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetGatewayId: targetGw })
        });
        const data = await res.json();
        showToast(`🔄 Active gateway switched to ${data.activeGatewayId}`);
        loadDiagnosticsData();
      } catch (err) {
        showToast('⚠️ Switch gateway failed');
      }
    }

    if (btnSwitchC1) btnSwitchC1.addEventListener('click', () => switchActiveGateway('C1'));
    if (btnSwitchC2) btnSwitchC2.addEventListener('click', () => switchActiveGateway('C2'));

    if (btnClearAllLocalStorage) {
      btnClearAllLocalStorage.addEventListener('click', () => {
        LocalStorageManager.clearAllStorage();

        conversations = [
          {
            id: 'chat-ai-assistant',
            name: 'Emergency AI Assistant',
            isAi: true,
            icon: '🤖',
            status: 'online',
            isPinned: true,
            isArchived: false,
            lastActivityTimestamp: Date.now(),
            lastMessage: 'Emergency AI Assistant Reset',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            unreadCount: 0,
            messages: [
              { id: 'm1', sender: 'AI Assistant', text: 'Emergency AI Assistant initialized offline over Bluetooth Mesh.', time: '13:40', isOutgoing: false, routing: 'Edge Local RAG', gateway: 'Gateway C1' }
            ]
          }
        ];

        LocalStorageManager.saveConversations(conversations);
        renderConversations();
        renderAiDedicatedThread();
        showToast('🧹 Storage & conversation history cleared');
      });
    }

    if (btnTestNotifNewMsg) btnTestNotifNewMsg.addEventListener('click', () => notifManager.notifyNewMessage('Node B2 - Medical', 'Emergency first aid team dispatched to Sector 4'));
    if (btnTestNotifAiResp) btnTestNotifAiResp.addEventListener('click', () => notifManager.notifyAiResponse('Edge Local RAG', 'CPR Protocol: 30 compressions followed by 2 rescue breaths'));
    if (btnTestNotifFail) btnTestNotifFail.addEventListener('click', () => notifManager.notifyDeliveryFailure('MSG-1002', 'Target node out of BLE RF range'));
    if (btnTestNotifGwUnavail) btnTestNotifGwUnavail.addEventListener('click', () => notifManager.notifyGatewayUnavailable('Gateway C1'));
    if (btnTestNotifMeshDisc) btnTestNotifMeshDisc.addEventListener('click', () => notifManager.notifyMeshDisconnected('Active RF Jamming detected on Channel 37'));

    window.copyMessageText = (text) => {
      navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!'))
        .catch(() => showToast('📋 Copied: ' + text));
    };

    window.deleteMessage = (chatId, msgId) => {
      const chat = conversations.find(c => c.id === chatId);
      if (!chat) return;

      chat.messages = chat.messages.filter(m => m.id !== msgId);
      if (chat.id === 'chat-ai-assistant') {
        LocalStorageManager.saveAiHistory(chat.messages);
        renderAiDedicatedThread();
      }

      chat.lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].text : 'No messages';
      LocalStorageManager.saveConversations(conversations);
      renderConversations();
      if (activeChatId === chatId) renderOverlayMessages(chat);
      showToast('🗑️ Message deleted');
    };

    window.retryFailedMessage = (chatId, msgId) => {
      const chat = conversations.find(c => c.id === chatId);
      if (!chat) return;

      const msg = chat.messages.find(m => m.id === msgId);
      if (!msg) return;

      msg.status = 'sent';
      showToast('🔄 Re-transmitting frame over Bluetooth Mesh...');
      renderOverlayMessages(chat);

      setTimeout(() => {
        msg.status = 'delivered';
        LocalStorageManager.saveConversations(conversations);
        renderOverlayMessages(chat);
        showToast('✓✓ Message delivered over BLE Mesh!');
      }, 1000);
    };

    function renderConversations() {
      if (!conversationList) return;
      const searchTerm = inputSearchChats ? inputSearchChats.value.toLowerCase().trim() : '';

      const filtered = conversations.filter(c => {
        const matchesName = c.name.toLowerCase().includes(searchTerm);
        const matchesLastMsg = c.lastMessage.toLowerCase().includes(searchTerm);
        const matchesMessages = c.messages.some(m => m.text.toLowerCase().includes(searchTerm));
        const matchesSearch = matchesName || matchesLastMsg || matchesMessages;

        if (!matchesSearch) return false;

        if (currentFilter === 'pinned') return c.isPinned && !c.isArchived;
        if (currentFilter === 'archived') return c.isArchived;
        if (currentFilter === 'ai') return c.isAi && !c.isArchived;
        if (currentFilter === 'p2p') return !c.isAi && !c.isArchived;

        return !c.isArchived;
      });

      filtered.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return (b.lastActivityTimestamp || 0) - (a.lastActivityTimestamp || 0);
      });

      conversationList.innerHTML = '';

      if (filtered.length === 0) {
        conversationList.innerHTML = `
          <div class="empty-state-card" role="region" aria-label="No Conversations Found">
            <span class="empty-icon" aria-hidden="true">💬</span>
            <div class="empty-title">No Conversations Found</div>
            <div class="empty-desc">No chats match your current filter or search criteria. Try clearing search or start a new conversation.</div>
            <button id="btnResetFilters" class="btn btn-sm btn-primary" style="margin-top:6px;">Reset Search & Filters</button>
          </div>
        `;
        const btnResetFilters = document.getElementById('btnResetFilters');
        if (btnResetFilters) {
          btnResetFilters.addEventListener('click', () => {
            if (inputSearchChats) inputSearchChats.value = '';
            currentFilter = 'all';
            filterChips.forEach(c => {
              c.classList.remove('active');
              c.setAttribute('aria-selected', 'false');
              if (c.getAttribute('data-filter') === 'all') {
                c.classList.add('active');
                c.setAttribute('aria-selected', 'true');
              }
            });
            renderConversations();
          });
        }
        return;
      }

      filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = `chat-item ${chat.isPinned ? 'pinned-item' : ''} ${chat.isArchived ? 'archived-item' : ''}`;
        item.tabIndex = 0;
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', `Open conversation with ${chat.name}`);
        item.onclick = () => openChatOverlay(chat.id);
        item.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChatOverlay(chat.id); } };

        const avatarClass = chat.isAi ? 'avatar-badge ai' : 'avatar-badge p2p';
        const tagBadge = chat.isAi ? '<span class="tag-ai">AI</span>' : '<span class="tag-p2p">P2P</span>';
        const pinTag = chat.isPinned ? '<span class="pin-icon-tag" title="Pinned">📌</span>' : '';
        const archiveTag = chat.isArchived ? '<span class="pin-icon-tag" title="Archived">📦</span>' : '';
        const unreadHtml = chat.unreadCount > 0 ? `<span class="unread-badge" aria-label="${chat.unreadCount} unread messages">${chat.unreadCount}</span>` : '';
        const statusDot = `<div class="status-indicator-dot ${chat.status || 'online'}"></div>`;

        item.innerHTML = `
          <div class="avatar-container">
            <div class="${avatarClass}">${chat.icon}</div>
            ${statusDot}
          </div>
          <div class="chat-info">
            <div class="chat-top-row">
              <div class="chat-name">${pinTag}${archiveTag}${chat.name} ${tagBadge}</div>
              <div class="chat-time">${chat.time}</div>
            </div>
            <div class="chat-bottom-row">
              <div class="chat-preview">${chat.lastMessage}</div>
              ${unreadHtml}
            </div>
          </div>
        `;
        conversationList.appendChild(item);
      });

      const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      if (navUnreadTotal) {
        navUnreadTotal.textContent = totalUnread;
        if (totalUnread === 0) navUnreadTotal.classList.add('hidden');
        else navUnreadTotal.classList.remove('hidden');
      }
    }

    function renderContacts() {
      if (!contactsList) return;
      const searchTerm = inputSearchContacts ? inputSearchContacts.value.toLowerCase().trim() : '';
      const filtered = contacts.filter(ct => ct.name.toLowerCase().includes(searchTerm) || ct.role.toLowerCase().includes(searchTerm));

      contactsList.innerHTML = '';
      if (filtered.length === 0) {
        contactsList.innerHTML = `
          <div class="empty-state-card">
            <span class="empty-icon">👥</span>
            <div class="empty-title">No Mesh Contacts Discovered</div>
            <div class="empty-desc">No local Bluetooth Mesh radio nodes match search.</div>
          </div>
        `;
        return;
      }

      filtered.forEach(ct => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        item.tabIndex = 0;
        item.innerHTML = `
          <div class="contact-left">
            <div class="avatar-container">
              <div class="avatar-badge p2p">👤</div>
              <div class="status-indicator-dot ${ct.status || 'online'}"></div>
            </div>
            <div>
              <div class="chat-name">${ct.name}</div>
              <div class="chat-preview">${ct.role} • Battery: ${ct.battery} • ${ct.hops} Hop</div>
            </div>
          </div>
          <div class="contact-rssi">${ct.rssi}</div>
        `;
        item.onclick = () => {
          let existing = conversations.find(c => c.name === ct.name);
          if (!existing) {
            existing = {
              id: `chat-${ct.id}`,
              name: ct.name,
              isAi: false,
              icon: '👤',
              status: ct.status || 'online',
              isPinned: false,
              isArchived: false,
              lastActivityTimestamp: Date.now(),
              lastMessage: 'Chat opened over mesh network',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              unreadCount: 0,
              messages: []
            };
            conversations.push(existing);
            LocalStorageManager.saveConversations(conversations);
          }
          router.navigateTo('chats');
          openChatOverlay(existing.id);
        };
        contactsList.appendChild(item);
      });
    }

    filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        filterChips.forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-selected', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-selected', 'true');
        currentFilter = chip.getAttribute('data-filter');
        renderConversations();
      });
    });

    if (inputSearchChats) inputSearchChats.addEventListener('input', renderConversations);
    if (inputSearchContacts) inputSearchContacts.addEventListener('input', renderContacts);

    function renderAiDedicatedThread() {
      if (!aiChatThread) return;
      const aiChat = conversations.find(c => c.id === 'chat-ai-assistant');
      if (!aiChat) return;

      aiChatThread.innerHTML = `
        <div class="message-bubble system-msg">
          🤖 Dedicated AI Assistant active. Operating offline over BLE Mesh. Ask emergency prompts or follow-up questions below.
        </div>
      `;

      aiChat.messages.forEach(msg => {
        const wrapper = document.createElement('div');
        const sideClass = msg.isOutgoing ? 'outgoing' : 'incoming';
        wrapper.className = `message-bubble-wrapper ${sideClass}`;

        let badgesHtml = '';
        if (!msg.isOutgoing && msg.sender !== 'You') {
          const routeBadgeClass = msg.routing && msg.routing.includes('Cloud') ? 'badge-routing cloud' : (msg.routing && msg.routing.includes('Cache') ? 'badge-routing cache' : 'badge-routing');
          const routeText = msg.routing || 'Edge Local RAG';
          const gwText = msg.gateway || 'Gateway C1 (Primary)';
          badgesHtml = `
            <div class="ai-badge-row">
              <span class="${routeBadgeClass}">${routeText}</span>
              <span class="badge-gateway">${gwText}</span>
            </div>
          `;
        }

        wrapper.innerHTML = `
          <div class="message-bubble ${sideClass}">
            ${msg.text.replace(/\n/g, '<br>')}
            ${badgesHtml}
            <div class="msg-meta-footer">
              <span class="msg-time">${msg.time}</span>
            </div>
          </div>
          <div class="msg-actions-bar">
            <button class="btn-msg-act" onclick="copyMessageText('${msg.text.replace(/'/g, "\\'")}')">📋 Copy</button>
            <button class="btn-msg-act" onclick="deleteMessage('chat-ai-assistant', '${msg.id}')">🗑️ Delete</button>
          </div>
        `;

        aiChatThread.appendChild(wrapper);
      });

      scrollToBottom(aiChatThread);
    }

    function openChatOverlay(chatId) {
      const chat = conversations.find(c => c.id === chatId);
      if (!chat) return;

      activeChatId = chatId;
      chat.unreadCount = 0;
      LocalStorageManager.saveConversations(conversations);
      renderConversations();

      overlayChatTitle.textContent = chat.name;
      overlayChatSub.textContent = chat.isAi ? 'Emergency AI Assistant' : `P2P Mesh Contact • Status: ${chat.status.toUpperCase()}`;
      overlayChatTypeBadge.textContent = chat.isAi ? 'AI' : 'P2P';
      overlayChatTypeBadge.style.background = chat.isAi ? 'var(--secondary)' : 'var(--primary)';

      if (btnHeaderPin) btnHeaderPin.textContent = chat.isPinned ? '📌 Unpin' : '📌 Pin';
      if (btnHeaderArchive) btnHeaderArchive.textContent = chat.isArchived ? '📦 Unarchive' : '📦 Archive';

      renderOverlayMessages(chat);
      chatOverlay.classList.remove('hidden');
      scrollToBottom(overlayChatThread);
    }

    function renderOverlayMessages(chat) {
      overlayChatThread.innerHTML = '';
      chat.messages.forEach(msg => {
        const wrapper = document.createElement('div');
        const sideClass = msg.isOutgoing ? 'outgoing' : 'incoming';
        wrapper.className = `message-bubble-wrapper ${sideClass}`;

        let statusHtml = '';
        if (msg.isOutgoing) {
          if (msg.status === 'failed' || msg.status === 'FAILED') {
            statusHtml = `<span class="status-icon failed-tag">⚠️ Failed</span> <button class="btn-retry" onclick="retryFailedMessage('${chat.id}', '${msg.id}')">Retry</button>`;
          } else if (msg.status === 'QUEUED') {
            statusHtml = `<span class="status-icon" style="color:#f59e0b;" title="Queued Offline">⏳ Offline Queued</span>`;
          } else if (msg.status === 'read' || msg.status === 'READ') {
            statusHtml = `<span class="status-icon read">✓✓</span>`;
          } else if (msg.status === 'delivered' || msg.status === 'DELIVERED') {
            statusHtml = `<span class="status-icon delivered">✓✓</span>`;
          } else {
            statusHtml = `<span class="status-icon sent">✓</span>`;
          }
        }

        let badgesHtml = '';
        if (chat.isAi && !msg.isOutgoing) {
          badgesHtml = `
            <div class="ai-badge-row">
              <span class="badge-routing">${msg.routing || 'Edge RAG'}</span>
              <span class="badge-gateway">${msg.gateway || 'Gateway C1'}</span>
            </div>
          `;
        }

        const bubbleClass = (msg.status === 'failed' || msg.status === 'FAILED') ? 'message-bubble failed' : `message-bubble ${sideClass}`;

        wrapper.innerHTML = `
          <div class="${bubbleClass}">
            ${msg.text.replace(/\n/g, '<br>')}
            ${badgesHtml}
            <div class="msg-meta-footer">
              <span class="msg-time">${msg.time}</span>
              ${statusHtml}
            </div>
          </div>
          <div class="msg-actions-bar">
            <button class="btn-msg-act" onclick="copyMessageText('${msg.text.replace(/'/g, "\\'")}')">📋 Copy</button>
            <button class="btn-msg-act" onclick="deleteMessage('${chat.id}', '${msg.id}')">🗑️ Delete</button>
          </div>
        `;

        overlayChatThread.appendChild(wrapper);
      });

      scrollToBottom(overlayChatThread);
    }

    btnCloseOverlay.addEventListener('click', () => {
      chatOverlay.classList.add('hidden');
      activeChatId = null;
    });

    if (btnHeaderRename) {
      btnHeaderRename.addEventListener('click', () => {
        if (!activeChatId) return;
        const chat = conversations.find(c => c.id === activeChatId);
        if (!chat) return;
        inputRenameTitle.value = chat.name;
        renameModal.classList.remove('hidden');
      });
    }

    if (btnSaveRename) {
      btnSaveRename.addEventListener('click', () => {
        const newTitle = inputRenameTitle.value.trim();
        if (newTitle && activeChatId) {
          const chat = conversations.find(c => c.id === activeChatId);
          if (chat) {
            chat.name = newTitle;
            overlayChatTitle.textContent = newTitle;
            LocalStorageManager.saveConversations(conversations);
            renderConversations();
            showToast('✏️ Conversation renamed to: ' + newTitle);
          }
        }
        renameModal.classList.add('hidden');
      });
    }

    if (btnCloseRename) btnCloseRename.addEventListener('click', () => renameModal.classList.add('hidden'));

    if (btnHeaderPin) {
      btnHeaderPin.addEventListener('click', () => {
        if (!activeChatId) return;
        const chat = conversations.find(c => c.id === activeChatId);
        if (!chat) return;
        chat.isPinned = !chat.isPinned;
        btnHeaderPin.textContent = chat.isPinned ? '📌 Unpin' : '📌 Pin';
        LocalStorageManager.saveConversations(conversations);
        renderConversations();
        showToast(chat.isPinned ? '📌 Conversation pinned to top' : '📌 Conversation unpinned');
      });
    }

    if (btnHeaderArchive) {
      btnHeaderArchive.addEventListener('click', () => {
        if (!activeChatId) return;
        const chat = conversations.find(c => c.id === activeChatId);
        if (!chat) return;
        chat.isArchived = !chat.isArchived;
        btnHeaderArchive.textContent = chat.isArchived ? '📦 Unarchive' : '📦 Archive';
        LocalStorageManager.saveConversations(conversations);
        renderConversations();
        showToast(chat.isArchived ? '📦 Conversation archived' : '📦 Conversation unarchived');
      });
    }

    if (btnCreateCustomChat) {
      btnCreateCustomChat.addEventListener('click', () => {
        const title = inputNewCustomChat.value.trim();
        if (!title) return;
        const newId = `chat-custom-${Date.now()}`;
        const newChat = {
          id: newId,
          name: title,
          isAi: false,
          icon: '💬',
          status: 'online',
          isPinned: false,
          isArchived: false,
          lastActivityTimestamp: Date.now(),
          lastMessage: 'Conversation created',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: 0,
          messages: []
        };
        conversations.unshift(newChat);
        inputNewCustomChat.value = '';
        newChatModal.classList.add('hidden');
        LocalStorageManager.saveConversations(conversations);
        renderConversations();
        openChatOverlay(newId);
        showToast('💬 Custom conversation created');
        notifManager.notifyNewMessage(title, 'Conversation created on Bluetooth Mesh');
      });
    }

    async function dispatchAiQuery(promptText) {
      const trimmed = String(promptText || '').trim();
      if (trimmed.length === 0) {
        if (valMsgAi) valMsgAi.classList.remove('hidden');
        return;
      }

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const aiChat = conversations.find(c => c.id === 'chat-ai-assistant');

      const userMsg = { id: `msg-${Date.now()}`, sender: 'You', text: trimmed, time, isOutgoing: true, status: 'read' };
      if (aiChat) {
        aiChat.messages.push(userMsg);
        aiChat.lastActivityTimestamp = Date.now();
      }

      if (aiProcessingBox) aiProcessingBox.classList.remove('hidden');

      renderAiDedicatedThread();
      if (activeChatId === 'chat-ai-assistant') renderOverlayMessages(aiChat);

      try {
        const res = await fetch('/api/send-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed })
        });
        const data = await res.json();
        if (aiProcessingBox) aiProcessingBox.classList.add('hidden');

        let responseText = '';
        let routingText = '';
        let gatewayText = '';

        if (data.source === 'QUERY_CACHE_HIT') {
          responseText = data.answer;
          routingText = '💎 15m MD5 Query Cache Hit';
          gatewayText = 'Cached Local';
        } else if (data.response && data.response.decision) {
          responseText = data.response.answer;
          const target = data.response.decision.target;
          routingText = target === 'CLOUD_GEMINI_2_0_FLASH' ? '☁️ Cloud Gemini 2.0 Flash' : '⚡ Edge Local RAG Engine';
          gatewayText = `Delivered via ${data.deliveredGatewayId || 'Gateway C1'}`;
        } else if (data.error) {
          responseText = `⚠️ AI Request Failed: ${data.error}`;
          routingText = 'FAILED';
          gatewayText = 'Gateway Offline';
        }

        const aiMsg = {
          id: `msg-${Date.now() + 1}`,
          sender: 'AI Assistant',
          text: responseText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isOutgoing: false,
          status: 'read',
          routing: routingText,
          gateway: gatewayText
        };

        if (aiChat) {
          aiChat.messages.push(aiMsg);
          aiChat.lastMessage = responseText;
          aiChat.time = time;
          aiChat.lastActivityTimestamp = Date.now();
          LocalStorageManager.saveAiHistory(aiChat.messages);
          LocalStorageManager.saveConversations(conversations);
        }

        renderConversations();
        renderAiDedicatedThread();
        if (activeChatId === 'chat-ai-assistant') renderOverlayMessages(aiChat);
        notifManager.notifyAiResponse(routingText, responseText);
        loadDiagnosticsData();

      } catch (err) {
        if (aiProcessingBox) aiProcessingBox.classList.add('hidden');
        const failMsg = {
          id: `msg-fail-${Date.now()}`,
          sender: 'AI Assistant',
          text: `⚠️ Request Failed: ${err.message}. Please retry or check BLE Mesh connection.`,
          time,
          isOutgoing: false,
          status: 'failed',
          routing: 'FAILED',
          gateway: 'Offline'
        };

        if (aiChat) {
          aiChat.messages.push(failMsg);
          LocalStorageManager.saveAiHistory(aiChat.messages);
          LocalStorageManager.saveConversations(conversations);
        }

        renderConversations();
        renderAiDedicatedThread();

        notifManager.notifyDeliveryFailure('AI-REQ-FAIL', err.message);
        notifManager.notifyGatewayUnavailable('Gateway C1');
        loadDiagnosticsData();
      }
    }

    if (btnSendAiQuery) {
      btnSendAiQuery.addEventListener('click', () => {
        const text = inputAiQuery.value;
        inputAiQuery.value = '';
        inputAiQuery.dispatchEvent(new Event('input'));
        dispatchAiQuery(text);
      });
    }

    if (inputAiQuery) {
      inputAiQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = inputAiQuery.value;
          inputAiQuery.value = '';
          inputAiQuery.dispatchEvent(new Event('input'));
          dispatchAiQuery(text);
        }
      });
    }

    shortcutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt) dispatchAiQuery(prompt);
      });
    });

    async function sendOverlayMessage() {
      const text = inputOverlayMessage.value;
      const trimmed = text.trim();
      if (trimmed.length === 0 || !activeChatId) return;

      if (activeChatId === 'chat-ai-assistant') {
        inputOverlayMessage.value = '';
        inputOverlayMessage.dispatchEvent(new Event('input'));
        await dispatchAiQuery(trimmed);
        return;
      }

      const chat = conversations.find(c => c.id === activeChatId);
      if (!chat) return;

      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const isNodeOnline = chat.status !== 'offline';

      const newMsg = {
        id: `msg-${Date.now()}`,
        sender: 'You',
        text: trimmed,
        time,
        isOutgoing: true,
        status: isNodeOnline ? 'SENT' : 'QUEUED'
      };

      chat.messages.push(newMsg);
      chat.lastMessage = trimmed;
      chat.time = time;
      chat.lastActivityTimestamp = Date.now();

      inputOverlayMessage.value = '';
      inputOverlayMessage.dispatchEvent(new Event('input'));

      LocalStorageManager.cacheMessages(chat.id, chat.messages);
      LocalStorageManager.saveConversations(conversations);

      renderOverlayMessages(chat);
      renderConversations();

      try {
        const res = await fetch('/api/mesh/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetNode: chat.id,
            text: trimmed,
            isOnline: isNodeOnline
          })
        });
        const data = await res.json();

        newMsg.status = data.status || 'SENT';
        LocalStorageManager.saveConversations(conversations);
        renderOverlayMessages(chat);

        if (data.status === 'QUEUED') {
          showToast('⏳ Node offline: Message queued in OfflineMeshQueue');
        } else if (data.status === 'DELIVERED') {
          showToast('✓✓ Message delivered over Bluetooth Mesh');
          setTimeout(() => {
            newMsg.status = 'READ';
            LocalStorageManager.saveConversations(conversations);
            renderOverlayMessages(chat);
          }, 2000);
        }
      } catch (err) {
        newMsg.status = 'FAILED';
        LocalStorageManager.saveConversations(conversations);
        renderOverlayMessages(chat);
        notifManager.notifyDeliveryFailure(newMsg.id, err.message);
      }
    }

    if (btnSendOverlayMessage) btnSendOverlayMessage.addEventListener('click', sendOverlayMessage);
    if (inputOverlayMessage) {
      inputOverlayMessage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendOverlayMessage();
        }
      });
    }

    if (btnSimulateFail) {
      btnSimulateFail.addEventListener('click', () => {
        if (!activeChatId) return;
        const chat = conversations.find(c => c.id === activeChatId);
        if (!chat) return;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const failId = `msg-failed-${Date.now()}`;
        chat.messages.push({ id: failId, sender: 'You', text: 'Emergency transmission timeout over BLE Mesh', time, isOutgoing: true, status: 'FAILED' });
        LocalStorageManager.saveConversations(conversations);
        renderOverlayMessages(chat);
        notifManager.notifyDeliveryFailure(failId, 'Simulated RF jamming packet loss');
      });
    }

    if (btnAskAi) btnAskAi.addEventListener('click', () => router.navigateTo('ai'));
    if (btnNewChat) btnNewChat.addEventListener('click', () => newChatModal.classList.remove('hidden'));
    if (modalClose) modalClose.addEventListener('click', () => newChatModal.classList.add('hidden'));

    if (modalStartAi) {
      modalStartAi.addEventListener('click', () => {
        newChatModal.classList.add('hidden');
        router.navigateTo('ai');
      });
    }

    if (modalStartP2p) {
      modalStartP2p.addEventListener('click', () => {
        newChatModal.classList.add('hidden');
        router.navigateTo('contacts');
      });
    }

    // Initial renders
    renderConversations();
    renderContacts();
    renderAiDedicatedThread();
    loadDiagnosticsData();
  });
}
