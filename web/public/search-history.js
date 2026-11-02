export function createHistory({esc}){
 const key='shiguang-search-history';
 function read(){try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter(s=>typeof s==='string').slice(0,10):[];}catch{return [];}}
 function save(value){const q=value.trim().slice(0,80);if(!q)return;try{localStorage.setItem(key,JSON.stringify([q,...read().filter(x=>x!==q)].slice(0,10)));}catch{}}
 function view(){const items=read();return items.length?`<div class="search-history"><span>最近搜索</span>${items.map((q,i)=>`<span class="history-chip"><button data-history-query="${esc(q)}">${esc(q)}</button><button data-history-remove="${i}" aria-label="删除搜索记录">×</button></span>`).join('')}<button class="clear-history" data-history-clear>清空</button></div>`:'';}
 function remove(index){try{const list=read();list.splice(index,1);localStorage.setItem(key,JSON.stringify(list));}catch{}}
 function clear(){try{localStorage.removeItem(key);}catch{}}
 return {save,view,remove,clear};
}
