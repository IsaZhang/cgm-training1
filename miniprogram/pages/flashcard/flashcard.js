const { request } = require('../../utils/api');

Page({
  data: {
    categories: [], currentCategory: '', currentCards: [],
    allCards: {}, cardIndex: 0, flipped: false,
    progress: {}, masteredCount: 0, showList: false
  },

  async onLoad() {
    const cards = await request('/flashcard/list');
    const cats = Object.keys(cards);
    const progressRes = await request('/flashcard/progress');
    this.setData({
      allCards: cards, categories: cats,
      currentCategory: cats[0], currentCards: cards[cats[0]] || [],
      progress: progressRes.progress || {}
    });
    this.updateMastered();
  },

  switchCategory(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({
      currentCategory: cat, currentCards: this.data.allCards[cat] || [],
      cardIndex: 0, flipped: false, showList: false
    });
    this.updateMastered();
  },

  flip() { this.setData({ flipped: !this.data.flipped }); },

  async markMaster() { await this.markCard(true); },
  async markWeak() { await this.markCard(false); },

  async markCard(mastered) {
    const card = this.data.currentCards[this.data.cardIndex];
    await request('/flashcard/progress', { method: 'POST', data: { card_id: card.id, mastered } });
    const progress = this.data.progress;
    progress[card.id] = { mastered: mastered ? 1 : 0 };
    this.setData({ progress });
    this.updateMastered();
    this.nextCard();
  },

  nextCard() {
    let next = this.data.cardIndex + 1;
    if (next >= this.data.currentCards.length) next = 0;
    this.setData({ cardIndex: next, flipped: false });
  },

  toggleList() {
    this.setData({ showList: !this.data.showList });
  },

  jumpToCard(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ cardIndex: index, flipped: false, showList: false });
  },

  updateMastered() {
    const cards = this.data.currentCards || [];
    const p = this.data.progress;
    const count = cards.filter(c => p[c.id] && p[c.id].mastered).length;
    this.setData({ masteredCount: count });
  }
});
