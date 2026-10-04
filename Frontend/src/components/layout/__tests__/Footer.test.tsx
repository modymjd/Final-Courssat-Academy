import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import Footer from "../Footer";
import * as themeHook from "@/hooks/usePlatformTheme";

vi.mock("@/hooks/usePlatformTheme");

describe("Footer Component - Social Media & Theme Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders social icons when social media links are present in themeData", () => {
    vi.spyOn(themeHook, "usePlatformTheme").mockReturnValue({
      data: {
        id: 1,
        site_name: "Courssat",
        siteName: "Courssat",
        site_tagline: "منصة تعليمية رائدة",
        primary_color: "#4f46e5",
        secondary_color: "#06b6d4",
        accent_color: "#f59e0b",
        dark_mode_enabled: true,
        hero_title: "",
        hero_subtitle: "",
        support_email: "support@example.com",
        support_phone: "01000000000",
        terms_url: "/terms",
        privacy_url: "/privacy",
        faq_url: "/faq",
        facebook_url: "https://facebook.com/elhetawy",
        facebookUrl: "https://facebook.com/elhetawy",
        twitter_url: "https://twitter.com/elhetawy",
        twitterUrl: "https://twitter.com/elhetawy",
        linkedin_url: "",
        youtube_url: "",
        instagram_url: "",
        cdn_cache_version: 1,
      },
      isLoading: false,
      isError: false,
    } as any);

    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

    // Facebook icon button should be in the document
    const fbLink = screen.getByLabelText("فيسبوك");
    expect(fbLink).toBeInTheDocument();
    expect(fbLink).toHaveAttribute("href", "https://facebook.com/elhetawy");

    // Twitter icon button should be in the document
    const twitterLink = screen.getByLabelText("تويتر");
    expect(twitterLink).toBeInTheDocument();
    expect(twitterLink).toHaveAttribute("href", "https://twitter.com/elhetawy");

    // LinkedIn, YouTube, Instagram should NOT be in the document
    expect(screen.queryByLabelText("لينكد إن")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("يوتيوب")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("إنستغرام")).not.toBeInTheDocument();
  });

  it("renders no social icons when all social media links are empty", () => {
    vi.spyOn(themeHook, "usePlatformTheme").mockReturnValue({
      data: {
        id: 1,
        site_name: "Courssat",
        siteName: "Courssat",
        site_tagline: "",
        primary_color: "#4f46e5",
        secondary_color: "#06b6d4",
        accent_color: "#f59e0b",
        dark_mode_enabled: true,
        hero_title: "",
        hero_subtitle: "",
        support_email: "",
        support_phone: "",
        terms_url: "",
        privacy_url: "",
        faq_url: "",
        facebook_url: "",
        facebookUrl: "",
        twitter_url: "",
        twitterUrl: "",
        linkedin_url: "",
        youtube_url: "",
        instagram_url: "",
        cdn_cache_version: 1,
      },
      isLoading: false,
      isError: false,
    } as any);

    render(
      <BrowserRouter>
        <Footer />
      </BrowserRouter>
    );

    expect(screen.queryByLabelText("فيسبوك")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("تويتر")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("لينكد إن")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("يوتيوب")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("إنستغرام")).not.toBeInTheDocument();
  });
});
