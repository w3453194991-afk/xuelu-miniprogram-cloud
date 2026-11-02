const root=document.querySelector('#app');
const tabs=[['home','⌂','首页'],['course','▦','课程'],['bus','▱','校车'],['tutor','♧','家教'],['profile','◉','我的']];
function sync(){
 if(!root.querySelector('.shell'))return;
 let nav=root.querySelector('.mobile-bottom-nav');
 if(!nav){nav=document.createElement('nav');nav.className='mobile-bottom-nav';nav.setAttribute('aria-label','手机主导航');root.append(nav);}
 const page=location.hash.slice(1)||'home';
 const active=['orders','join','help','feedback','about','admin'].includes(page)?'profile':page;
 const markup=tabs.map(([id,icon,label])=>`<button type="button" data-page="${id}" class="${active===id?'active':''}" ${active===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span><small>${label}</small></button>`).join('');
 if(nav.innerHTML!==markup)nav.innerHTML=markup;
 let shortcuts=root.querySelector('.mobile-shortcuts');
 if(!shortcuts){shortcuts=document.createElement('div');shortcuts.className='mobile-shortcuts';shortcuts.innerHTML='<button data-page="orders">我的订单</button><button data-page="join">我要入驻</button><button data-page="help">帮助中心</button><button data-page="admin">管理台</button>';root.querySelector('.sidebar').append(shortcuts);}
}
new MutationObserver(sync).observe(root,{childList:true});
window.addEventListener('hashchange',sync);sync();
