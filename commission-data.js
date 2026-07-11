// HKTVmall Commission Data
// Source: https://hktvcommissionsearcher.netlify.app/
// Last Updated: 2026-04-28

window.COMMISSION_DATA = [
{"code": "AA31050500001", "rate": 3.0, "name": "iPhone", "level": "Sub2", "termsSource": "AA31050500001", "path": "Gadgets & Electronics > 手機 > iPhone"},
{"code": "AA31051000001", "rate": 3.0, "name": "Samsung 手機", "level": "Sub2", "termsSource": "AA31051000001", "path": "Gadgets & Electronics > 手機 > Samsung 手機"},
{"code": "AA31051500001", "rate": 8.0, "name": "華為 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > 華為 手機"},
{"code": "AA31052000001", "rate": 8.0, "name": "小米 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > 小米 手機"},
{"code": "AA31052500001", "rate": 8.0, "name": "Sony 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > Sony 手機"},
{"code": "AA31053000001", "rate": 8.0, "name": "LG 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > LG 手機"},
{"code": "AA31053500001", "rate": 8.0, "name": "Lenovo 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > Lenovo 手機"},
{"code": "AA31054000001", "rate": 8.0, "name": "Oppo 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > Oppo 手機"},
{"code": "AA31054500001", "rate": 8.0, "name": "Vivo 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > Vivo 手機"},
{"code": "AA31055000001", "rate": 8.0, "name": "HTC 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > HTC 手機"},
{"code": "AA31055500001", "rate": 8.0, "name": "Nokia 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > Nokia 手機"},
{"code": "AA31056000001", "rate": 8.0, "name": "Motorola 手機", "level": "Sub2", "termsSource": "AA31050000000", "path": "Gadgets & Electronics > 手機 > Motorola 手機"},
{"code": "AA31100500001", "rate": 3.0, "name": "Apple iPad", "level": "Sub2", "termsSource": "AA31100500001", "path": "Gadgets & Electronics > 平板電腦 電子書閱讀器 > Apple iPad"},
{"code": "AA31101000001", "rate": 3.0, "name": "Samsung Galaxy Tab", "level": "Sub2", "termsSource": "AA31101000001", "path": "Gadgets & Electronics > 平板電腦 電子書閱讀器 > Samsung Galaxy Tab"},
{"code": "AA11603010001", "rate": 26.0, "name": "麵包", "level": "Sub2", "termsSource": "AA11600000000", "path": "Supermarket > 早餐 果醬 > 麵包"},
{"code": "AA11606000001", "rate": 26.0, "name": "新鮮麵包", "level": "Sub2", "termsSource": "AA11600000000", "path": "Supermarket > 早餐 果醬 > 新鮮麵包"},
{"code": "AA87203415001", "rate": 20.0, "name": "甜點麵包", "level": "Sub2", "termsSource": "AA87200000000", "path": "Toys & Books > 圖書 > 食譜 > 甜點麵包"},
{"code": "AA11603020001", "rate": 26.0, "name": "果醬", "level": "Sub3", "termsSource": "AA11600000000", "path": "Supermarket > 早餐 果醬 > 果醬 麵包醬 > 果醬"},
{"code": "AA11603030001", "rate": 26.0, "name": "花生醬", "level": "Sub3", "termsSource": "AA11600000000", "path": "Supermarket > 早餐 果醬 > 果醬 麵包醬 > 花生醬"},
{"code": "AA11603040001", "rate": 26.0, "name": "麵包醬", "level": "Sub3", "termsSource": "AA11600000000", "path": "Supermarket > 早餐 果醬 > 果醬 麵包醬 > 麵包醬"},
{"code": "AA18151540001", "rate": 26.0, "name": "麵包刀", "level": "Sub3", "termsSource": "AA18000000000", "path": "Housewares > 廚具 > 刀 > 麵包刀"},
{"code": "AA32184020001", "rate": 15.0, "name": "麵包機", "level": "Sub3", "termsSource": "AA32180000000", "path": "Home Appliances > 廚房電器 > 多士爐 窩夫 乾果機 > 麵包機"}
];

window.COMMISSION_COUNT = window.COMMISSION_DATA.length;
window.COMMISSION_UPDATED = '2026-04-28';

// Lookup function - searches by name or path
window.lookupCommission = function(query) {
    if (!query || !window.COMMISSION_DATA) return [];
    query = query.toLowerCase().trim();
    if (query.length < 1) return [];
    
    var results = [];
    for (var i = 0; i < window.COMMISSION_DATA.length; i++) {
        var item = window.COMMISSION_DATA[i];
        if (item.name.toLowerCase().indexOf(query) >= 0 ||
            item.path.toLowerCase().indexOf(query) >= 0 ||
            item.code.toLowerCase().indexOf(query) >= 0) {
            results.push(item);
        }
    }
    
    // Sort by relevance (exact matches first, then by rate)
    results.sort(function(a, b) {
        var aExact = a.name.toLowerCase() === query || a.path.toLowerCase() === query;
        var bExact = b.name.toLowerCase() === query || b.path.toLowerCase() === query;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return b.rate - a.rate;
    });
    
    return results;
};

console.log('Commission data loaded: ' + window.COMMISSION_COUNT + ' records');
