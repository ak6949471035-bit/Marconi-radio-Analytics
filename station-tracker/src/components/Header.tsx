import { ClientOnly, Link } from "@tanstack/react-router";
import { Radio, Disc3, ChartColumn, Heart, Menu, Github } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logo from "../assets/logo.png";

const GITHUB_URL = "https://github.com/lorisleitner/station-tracker";

const navLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Stations", icon: Radio },
  { to: "/tracks", label: "Tracks", icon: Disc3 },
  { to: "/favorites", label: "Favorites", icon: Heart },
  { to: "/analytics", label: "Analytics", icon: ChartColumn },
];

export default function Header() {
  return (
    // Bug: Nav links are not correctly highlighted when navigating directly
    <ClientOnly>
      <div className="navbar sticky top-0 z-50 bg-base-100 shadow-sm">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <Menu className="h-6 w-6" />
            </div>
            <ul
              tabIndex={0}
              className="menu menu-md dropdown-content bg-base-100 rounded-box z-10 mt-3 w-56 p-2 shadow"
            >
              {navLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    activeProps={{ className: "menu-active" }}
                    onClick={() =>
                      document.activeElement instanceof HTMLElement &&
                      document.activeElement.blur()
                    }
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                </li>
              ))}
              <div className="divider my-1" />
              <li>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="h-5 w-5" />
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          <Link to="/" className="btn btn-ghost text-xl gap-2">
            <img src={logo} alt="Station Tracker" className="h-7 w-auto object-contain" />
            Station Tracker
          </Link>
        </div>
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1 gap-2">
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} activeProps={{ className: "menu-active" }}>
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="navbar-end">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-circle hidden lg:flex"
            title="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </ClientOnly>
  );
}
