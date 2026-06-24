import React, { useState, useEffect } from "react";
import "./BottomNav.css";

// Iconos SVG en línea
const MessageCircleIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
);

const PaperPlaneIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="3 11 22 2 13 21 11 13 3 11" fill="currentColor" fillOpacity="0.1" />
    </svg>
);

const HomeIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
);

const UtensilsIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M18 8h1a4 4 0 010 8h-1" />
        <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
);

const UserIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);

const MapIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
        <line x1="9" y1="3" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
);

const navItems = [
    { id: 'destinos', label: 'Explora', href: '/#hero', icon: PaperPlaneIcon },
    { id: 'hoteles', label: 'Hoteles', href: '/donde-hospedarse', icon: HomeIcon },
    { id: 'restaurantes', label: 'Cocina', href: '/donde-comer', icon: UtensilsIcon },
    { id: 'quehacer', label: 'Qué Hacer', href: '/que-hacer', icon: MapIcon },
    { id: 'guias', label: 'Guías', href: '/guias-turisticos', icon: UserIcon },
];

export default function BottomNav() {
    const [activeItem, setActiveItem] = useState<string>('destinos'); // default

    useEffect(() => {
        const hash = window.location.hash;
        const pathname = window.location.pathname;

        let matched = false;
        for (const item of navItems) {
            if (pathname.startsWith(item.href)) {
                setActiveItem(item.id);
                matched = true;
                break;
            }
        }

        if (!matched && pathname === '/' && !hash) {
            setActiveItem(navItems[0].id);
        }

        // Opcional: Escuchar eventos de cambio de hash si navegamos estando en la misma página
        const handleHashChange = () => {
            const currentHash = window.location.hash;
            const match = navItems.find(item => item.href.includes(currentHash));
            if (match) setActiveItem(match.id);
        };
        window.addEventListener('hashchange', handleHashChange);
        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    return (
        <>
            {/* Bottom nav (solo mobile) */}
            <div
                id="bottom-nav"
                className="bottom-nav"
                role="navigation"
                aria-label="Navegación principal móvil"
            >
                {navItems.map((item) => {
                    const isActive = activeItem === item.id;
                    const Icon = item.icon;

                    return (
                        <a
                            key={item.id}
                            href={item.href}
                            id={`bn-${item.id}`}
                            className={`bottom-nav-link ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveItem(item.id)}
                        >
                            <Icon className="bottom-nav-icon" />
                            <span className="bottom-nav-label">{item.label}</span>
                        </a>
                    );
                })}
            </div>
        </>
    );
}
