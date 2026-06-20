var Storage={get:function(k,d){try{var r=localStorage.getItem(k);if(r===null)return d;return JSON.parse(r)}catch(e){return d}},set:function(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){showToast('存储空间不足')}},remove:function(k){localStorage.removeItem(k)},clearAll:function(){localStorage.clear()}};
function getPartnerName(){var s=Storage.get('settings_ta',{profileName:'TA'});return s.profileName||'TA'}
function getMoodState(p){return Storage.get('moodState_'+p,{status:'sunny',updatedAt:null,message:''})}
function getEntries(p){return Storage.get('treeholeEntries_'+p,[])}
function saveEntry(e,p){var a=getEntries(p);a.unshift(e);Storage.set('treeholeEntries_'+p,a)}
function updateEntry(id,u,p){var a=getEntries(p);var i=a.findIndex(function(e){return e.id===id});if(i!==-1){a[i]=Object.assign({},a[i],u);Storage.set('treeholeEntries_'+p,a)}}
function deleteEntry(id,p){var a=getEntries(p).filter(function(e){return e.id!==id});Storage.set('treeholeEntries_'+p,a)}
function getSharedFromPartner(){return getEntries('ta').filter(function(e){return e.shared})}
function getSettings(p){return Storage.get('settings_'+p,{notificationsEnabled:true,profileName:p==='me'?'我':'TA'})}
function saveSettings(s,p){Storage.set('settings_'+p,s)}
