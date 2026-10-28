// Presentation-only sample data. No Supabase, reservations or payment calls.
const sampleServices = [
    {id:'individual',category:'private',name:'Individual training',description:'Focused time for your own goals, at your own pace.',duration:'60 min',price:350,basis:'per session'},
    {id:'together',category:'group',name:'Train together',description:'Share a private session with someone who keeps you motivated.',duration:'60 min · 2 people',price:500,basis:'per group'},
    {id:'movement',category:'class',name:'Movement class',description:'Move, stretch and recharge in a shared group session.',duration:'45 min',price:120,basis:'per person'},
    {id:'personal',category:'private',name:'Personal coaching',description:'A little guidance and dedicated support for your next step.',duration:'45 min',price:280,basis:'per session'},
    {id:'smallgroup',category:'group',name:'Small group training',description:'Make progress together in a session for your group.',duration:'60 min · 4 people',price:800,basis:'per group'},
    {id:'strength',category:'class',name:'Strength class',description:'A shared session to build strength and confidence.',duration:'50 min',price:150,basis:'per person'}
];
const categoryNames={all:'All sessions',private:'Private sessions',group:'Group sessions',class:'Classes'};
const cart=new Map();
let toastTimeout;
const get=id=>document.getElementById(id);
const money=value=>'R'+value.toFixed(2);
function element(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function totals(){let count=0,total=0;for(const [id,quantity] of cart){const service=sampleServices.find(s=>s.id===id);count+=quantity;total+=service.price*quantity;}return {count,total};}
function renderCart(){
    const {count,total}=totals();
    get('cart-count').textContent=count;
    get('mobile-count').textContent=count;
    get('mobile-total').textContent=money(total);
    get('mobile-cart').hidden=!count;
    get('cart-total').textContent=money(total);
    const items=get('cart-items');items.replaceChildren();
    if(!count)items.appendChild(element('p','empty-cart','Your cart is empty. Browse the catalogue to add a session.'));
    for(const [id,quantity] of cart){
        const service=sampleServices.find(s=>s.id===id);
        const row=element('div','cart-item'),info=element('div');
        info.appendChild(element('strong','',service.name));
        info.appendChild(element('small','',quantity+' × '+money(service.price)+' · '+service.basis));
        row.appendChild(info);
        const remove=element('button','remove-item','Remove');remove.type='button';
        remove.setAttribute('aria-label','Remove '+service.name);
        remove.addEventListener('click',()=>{cart.delete(id);renderCart();});
        row.appendChild(remove);items.appendChild(row);
    }
}
function addToCart(service){
    cart.set(service.id,(cart.get(service.id)||0)+1);
    renderCart();
    get('toast').textContent=service.name+' added to cart';
    get('toast').classList.add('visible');
    clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>get('toast').classList.remove('visible'),2200);
    const trigger=get('open-cart');trigger.classList.remove('cart-pop');
    void trigger.offsetWidth;trigger.classList.add('cart-pop');
}
function renderServices(category='all'){
    const services=sampleServices.filter(s=>category==='all'||s.category===category);
    get('category-heading').textContent=categoryNames[category];
    get('service-count').textContent=services.length+' sessions';
    const grid=get('service-grid');grid.replaceChildren();
    for(const service of services){
        const card=element('article','service-card');
        const photo=element('div','photo','Your service photo');photo.setAttribute('aria-hidden','true');card.appendChild(photo);
        const body=element('div','card-body');
        body.appendChild(element('span','card-category',categoryNames[service.category]));
        body.appendChild(element('h3','',service.name));
        body.appendChild(element('p','card-description',service.description));
        body.appendChild(element('span','card-duration',service.duration));
        const bottom=element('div','card-bottom'),price=element('div','price',money(service.price));
        price.appendChild(element('small','',service.basis));bottom.appendChild(price);
        const add=element('button','add-button','Add +');add.type='button';add.setAttribute('aria-label','Add '+service.name+' to cart');
        add.addEventListener('click',()=>addToCart(service));bottom.appendChild(add);
        body.appendChild(bottom);card.appendChild(body);grid.appendChild(card);
    }
}
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
    document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    renderServices(button.dataset.category);
}));
for(const id of ['open-cart','mobile-cart'])get(id).addEventListener('click',()=>{renderCart();get('cart-dialog').showModal();});
for(const id of ['close-cart','keep-browsing'])get(id).addEventListener('click',()=>get('cart-dialog').close());
renderServices();renderCart();
