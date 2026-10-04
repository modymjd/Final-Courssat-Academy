import React, { Suspense, type ReactNode } from "react";
import Header from "./Header";

const Footer = React.lazy(() => import("./Footer"));

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow animate-fade-in">
        {children}
      </main>
      <Suspense fallback={<div className="h-64 bg-muted animate-pulse" />}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default Layout;
