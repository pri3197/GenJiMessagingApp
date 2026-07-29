/**
 * Mobile Navigation Router - Task 1
 * Manages client-side screen routing between Chats, Contacts, AI Assistant, and Settings screens.
 */

export class MobileRouter {
  constructor(options = {}) {
    this.defaultScreen = options.defaultScreen || 'chats';
    this.currentScreen = this.defaultScreen;
    this.listeners = [];
  }

  /**
   * Initializes router listeners on bottom navigation bar items
   */
  init() {
    const navItems = document.querySelectorAll('.bottom-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetScreen = item.getAttribute('data-screen');
        if (targetScreen) {
          this.navigateTo(targetScreen);
        }
      });
    });

    // Navigate to initial default screen
    this.navigateTo(this.defaultScreen);
  }

  /**
   * Navigates to a target screen ID
   * @param {string} screenId - 'chats' | 'contacts' | 'ai' | 'settings'
   */
  navigateTo(screenId) {
    const screens = document.querySelectorAll('.screen-view');
    const navItems = document.querySelectorAll('.bottom-nav-item');

    let found = false;
    screens.forEach(screen => {
      if (screen.id === `screen-${screenId}`) {
        screen.classList.add('active-screen');
        found = true;
      } else {
        screen.classList.remove('active-screen');
      }
    });

    if (!found) return;

    navItems.forEach(item => {
      if (item.getAttribute('data-screen') === screenId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.currentScreen = screenId;
    this.notifyListeners(screenId);
  }

  /**
   * Subscribes a listener callback to screen navigation events
   * @param {function(string): void} listener 
   */
  onNavigate(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
  }

  /**
   * Notifies subscribers of screen change
   * @private
   */
  notifyListeners(screenId) {
    this.listeners.forEach(fn => {
      try {
        fn(screenId);
      } catch (err) {
        console.error('Router listener error:', err);
      }
    });
  }
}
