import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useCurrency } from '../context/CurrencyContext';
import { useState, useEffect } from 'react';

export default function CustomerLayout() {
  const { user, logout }    = useAuth();
  const { count }           = useCart();
  const { currency }        = useCurrency();
  const navigate            = useNavigate();
  const location            = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme]   = useState(() => localStorage.getItem('modart-theme') || 'light');

  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('modart-theme', next);
  };

  const navTransparent = isHome && !scrolled;

  const navLinks = [
    { label: 'Home',      path: '/' },
    { label: 'Shop',      path: '/shop' },
    { label: 'Customize', path: '/customize' },
    { label: 'Community', path: '/community' },
  ];

  return (
    <>
      {/* Skip link */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Desktop Nav */}
      <nav className="desktop-nav" style={navTransparent ? {
        background: 'rgba(0,0,0,0)',
        borderBottomColor: 'rgba(255,255,255,0)',
        backdropFilter: 'blur(0px)',
      } : {}}>
        <div className="nav-inner-grid">
          <div className="nav-logo-wrap">
            <button className="nav-logo" onClick={() => navigate('/')} aria-label="ModArt home">
              <img src="/assets/modart-logo.png" alt="ModArt" className="nav-logo-img"
                onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }}/>
              <span className="nav-logo-fallback" style={{display:'none'}}>MODART</span>
            </button>
          </div>
          <ul className="nav-links" role="list">
            {navLinks.map(l => (
              <li key={l.path}>
                <button
                  className={`nav-link${location.pathname === l.path ? ' active' : ''}`}
                  onClick={() => navigate(l.path)}
                  style={navTransparent ? { color: 'rgba(255,255,255,0.82)' } : {}}
                >
                  {l.label}
                </button>
              </li>
            ))}
          </ul>
          <div className="nav-actions">
            <span className="nav-currency-badge" style={{fontSize:'10px',fontWeight:700,letterSpacing:'.1em',color:'var(--g3)',padding:'4px 8px'}}>
              {currency.symbol} {currency.code}
            </span>
            <button className="theme-toggle-btn nav-icon-btn" aria-label="Toggle theme" onClick={toggleTheme}>
              <span className="material-symbols-outlined icon">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
            </button>
            <button className="nav-icon-btn" aria-label="Bag" onClick={() => navigate('/bag')} style={{position:'relative'}}>
              <span className="material-symbols-outlined icon">shopping_bag</span>
              {count > 0 && <span className="cart-badge">{count}</span>}
            </button>
            {user ? (
              <button className="nav-icon-btn nav-avatar-btn" onClick={() => navigate('/account')} aria-label="My account">
                <span className="nav-avatar">
                  {(user.user_metadata?.full_name || user.email || 'U').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
                </span>
              </button>
            ) : (
              <button className="nav-icon-btn" onClick={() => navigate('/login')}
                style={{fontSize:'11px',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',padding:'8px 12px'}}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Header */}
      <header className="mobile-hdr">
        <button className="nav-icon-btn" aria-label="Menu" onClick={() => setMenuOpen(true)}>
          <span className="material-symbols-outlined icon">menu</span>
        </button>
        <button className="mobile-logo-btn" onClick={() => navigate('/')} aria-label="ModArt home">
          <img src="/assets/modart-logo.png" alt="ModArt" className="nav-logo-img"
            onError={e => { e.target.style.display='none'; }}/>
        </button>
        <div className="mobile-hdr-actions">
          <button className="nav-icon-btn" aria-label="Bag" onClick={() => navigate('/bag')} style={{position:'relative'}}>
            <span className="material-symbols-outlined icon">shopping_bag</span>
            {count > 0 && <span className="cart-badge">{count}</span>}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {menuOpen && (
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',zIndex:998}} onClick={() => setMenuOpen(false)}/>
          <nav style={{position:'fixed',top:0,left:0,width:'80%',maxWidth:300,height:'100%',background:'var(--black)',zIndex:999,display:'flex',flexDirection:'column',padding:'24px 20px',overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:32}}>
              <span style={{fontSize:14,fontWeight:900,letterSpacing:'.2em',textTransform:'uppercase',color:'#fff'}}>Menu</span>
              <button onClick={() => setMenuOpen(false)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.5)',fontSize:22}}>✕</button>
            </div>
            {navLinks.map(l => (
              <button key={l.path} onClick={() => { navigate(l.path); setMenuOpen(false); }}
                style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',fontFamily:'var(--font)',fontSize:13,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',textAlign:'left',padding:'14px 0',borderBottom:'1px solid rgba(255,255,255,.06)',cursor:'pointer'}}>
                {l.label}
              </button>
            ))}
            {user ? (
              <button onClick={() => { navigate('/account'); setMenuOpen(false); }}
                style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',fontFamily:'var(--font)',fontSize:13,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',textAlign:'left',padding:'14px 0',cursor:'pointer'}}>
                Account
              </button>
            ) : (
              <button onClick={() => { navigate('/login'); setMenuOpen(false); }}
                style={{background:'none',border:'none',color:'rgba(255,255,255,.7)',fontFamily:'var(--font)',fontSize:13,fontWeight:700,letterSpacing:'.14em',textTransform:'uppercase',textAlign:'left',padding:'14px 0',cursor:'pointer'}}>
                Sign In
              </button>
            )}
          </nav>
        </>
      )}

      {/* Main content */}
      <main id="main-content">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {[
          { path:'/',         icon:'home',         label:'Home' },
          { path:'/shop',     icon:'storefront',   label:'Shop' },
          { path:'/customize',icon:'brush',        label:'Create' },
          { path:'/bag',      icon:'shopping_bag', label:'Bag', badge: count },
          { path:'/account',  icon:'person',       label:'Account' },
        ].map(item => (
          <button key={item.path} className={`mob-nav-item${location.pathname === item.path ? ' active' : ''}`}
            onClick={() => navigate(item.path)} aria-label={item.label} style={{position:'relative'}}>
            <span className="material-symbols-outlined icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span style={{position:'absolute',top:6,right:'calc(50% - 18px)',background:'var(--red)',color:'#fff',borderRadius:'50%',width:16,height:16,fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="mob-nav-spacer" />
    </>
  );
}
