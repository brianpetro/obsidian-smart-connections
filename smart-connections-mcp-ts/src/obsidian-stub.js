/**
 * Minimal stub for Obsidian API to make obsidian-smart-env work in Node.js
 * Only implements the parts actually used by Smart Connections MCP server
 */

// Mock Notice class - just logs instead of showing UI notifications
export class Notice {
  constructor(message, timeout = 0) {
    if (typeof message === 'string') {
      console.log(`[Notice] ${message}`);
    } else {
      // Handle DocumentFragment or other objects
      console.log(`[Notice] ${message}`);
    }
  }
}

// Mock Platform object - assume desktop for MCP server
export const Platform = {
  isMobile: false,
  isDesktop: true,
  isPhone: false,
  isTablet: false,
  isMacOS: process.platform === 'darwin',
  isWin: process.platform === 'win32',
  isLinux: process.platform === 'linux',
};

// Mock TFile class - minimal file representation
export class TFile {
  constructor(path) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = this.name.includes('.') ? this.name.split('.').pop() : '';
    this.basename = this.name.replace(`.${this.extension}`, '');
    this.stat = {
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0,
    };
  }
}

// Mock setIcon function - no-op since we don't have UI
export function setIcon(element, iconName) {
  // No-op in Node.js environment
  console.log(`[setIcon] Would set icon "${iconName}" on element`);
}

// Export default object with all the mocks
export default {
  Notice,
  Platform,
  TFile,
  setIcon,
};