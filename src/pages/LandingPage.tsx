import { motion } from "framer-motion";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useTheme } from "@/contexts/ThemeContext";
import { destinations } from "@/data/destinations";
import { features, type Feature } from "@/data/features";
import { howItWorksSteps } from "@/data/howItWorks";
import type { ThemeTokens } from "@/themes";

type LandingPageProps = {
  onStart: () => void;
  onMyTrips?: () => void;
};

function getFeatureIcon(id: string, theme: ThemeTokens) {
  if (id === "ai-planning") {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={theme.accentSky} strokeWidth="1.5" />
        <path d="M10 16l4 4 8-8" stroke={theme.accentSky} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="23" cy="9" r="3" fill={theme.accentDeep} />
        <path d="M21 9h4M23 7v4" stroke={theme.accentSky} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "personalized") {
    return (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="12" r="5" stroke={theme.accentSky} strokeWidth="1.5" />
        <path d="M6 26c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke={theme.accentSky} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M22 4l2 2-2 2" stroke={theme.accentMid} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="6" width="24" height="18" rx="3" stroke={theme.accentSky} strokeWidth="1.5" />
      <path d="M10 13h12M10 17h8" stroke={theme.accentSky} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="22" r="5" fill={theme.accentDeep} />
      <path d="M22 22l1 1 2-2" stroke={theme.accentSky} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LandingPage({ onStart, onMyTrips }: LandingPageProps) {
  const { theme } = useTheme();

  return (
    <div style={{ background: theme.pageBg, minHeight: "100vh", overflowX: "hidden", transition: "background 0.3s" }}>
      <Navbar variant="marketing" onStart={onStart} onHome={() => window.scrollTo({ top: 0, behavior: "smooth" })} />

      {/* HERO */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-5"
        style={{
          minHeight: "100svh",
          background: theme.heroBg,
          paddingTop: "5rem",
          paddingBottom: "5rem",
          transition: "background 0.3s",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${theme.heroGridLine} 1px, transparent 1px), linear-gradient(90deg, ${theme.heroGridLine} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: "5%",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(600px, 90vw)",
            height: "min(600px, 90vw)",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${theme.heroGlow} 0%, transparent 70%)`,
            filter: "blur(40px)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 w-full max-w-4xl mx-auto"
        >
          <div
            className="inline-flex items-center gap-2 mb-6 md:mb-8 px-4 py-2 rounded-full"
            style={{ background: theme.badgeBg, border: `1px solid ${theme.badgeBorder}` }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: theme.accentSky }} />
            <span style={{ color: theme.badgeText, fontSize: "0.72rem", letterSpacing: "0.08em", fontFamily: "system-ui, sans-serif" }}>
              AI-POWERED TRAVEL PLANNING
            </span>
          </div>

          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(3rem, 13vw, 7rem)",
              color: theme.heading,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              marginBottom: "1rem",
              transition: "color 0.3s",
            }}
          >
            Rihla<span style={{ color: theme.accentSky }}>Tech</span>
          </h1>

          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              fontSize: "clamp(1.15rem, 4vw, 1.8rem)",
              color: theme.accentLabel,
              fontStyle: "italic",
              letterSpacing: "0.01em",
              marginBottom: "1.25rem",
              transition: "color 0.3s",
            }}
          >
            Powered by AI, driven by you.
          </p>

          <p
            className="mx-auto mb-8 md:mb-10"
            style={{
              color: theme.body,
              fontSize: "clamp(0.95rem, 2.5vw, 1.1rem)",
              lineHeight: "1.7",
              maxWidth: "520px",
              fontFamily: "system-ui, sans-serif",
              transition: "color 0.3s",
            }}
          >
            Tell us your dream destination. Our AI builds the perfect itinerary — personalized to your budget, style, and interests — in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 px-2">
            <motion.button
              whileHover={{ scale: 1.03, boxShadow: "0 0 30px rgba(30,75,136,0.4)" }}
              whileTap={{ scale: 0.98 }}
              onClick={onStart}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white cursor-pointer transition-all"
              style={{
                background: `linear-gradient(135deg, ${theme.accentDeep} 0%, ${theme.accentMid} 100%)`,
                border: `1px solid ${theme.border}`,
                fontSize: "1rem",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              Plan My Trip
            </motion.button>
            <button
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium cursor-pointer transition-all"
              style={{
                background: "transparent",
                border: `1px solid ${theme.btnOutlineBorder}`,
                color: theme.btnOutlineText,
                fontSize: "1rem",
                fontFamily: "system-ui, sans-serif",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.btnOutlineBorder)}
            >
              Learn More
            </button>
          </div>

          <p style={{ color: theme.muted, fontSize: "0.88rem", fontFamily: "system-ui, sans-serif", marginTop: "2rem" }}>
            Personalized itineraries in minutes — flights, stays, and activities in one place.
          </p>
        </motion.div>

        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-1" style={{ color: theme.scrollIndicator }}>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.1em", fontFamily: "system-ui, sans-serif" }}>SCROLL</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 6l4 4 4-4" stroke={theme.scrollIndicator} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-16 md:py-24 px-5" style={{ background: theme.sectionAlt, transition: "background 0.3s" }}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.6 }} className="text-center mb-10 md:mb-16"
          >
            <p style={{ color: theme.accentSky, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "system-ui, sans-serif" }}>
              WHY RIHLATECH
            </p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.75rem, 5vw, 3rem)", color: theme.heading, marginBottom: "1rem" }}>
              Travel smarter, not harder.
            </h2>
            <p style={{ color: theme.muted, maxWidth: "480px", margin: "0 auto", lineHeight: "1.7", fontFamily: "system-ui, sans-serif", fontSize: "0.95rem" }}>
              From the moment you dream to the day you depart, RihlaTech handles the complexity so you can focus on the experience.
            </p>
          </motion.div>

          {/* TODO: replace with API call — getFeatures() */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            {features.map((f: Feature, i: number) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-2xl p-6 md:p-8 cursor-default"
                style={{
                  background: theme.cardBgGradient,
                  border: `1px solid ${theme.cardBorder}`,
                  backdropFilter: "blur(8px)",
                  boxShadow: theme.cardShadow,
                  transition: "background 0.3s, border-color 0.3s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.cardHoverBorder)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.cardBorder)}
              >
                <div className="mb-4">{getFeatureIcon(f.id, theme)}</div>
                <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: theme.heading, marginBottom: "0.6rem" }}>
                  {f.title}
                </h3>
                <p style={{ color: theme.body, lineHeight: "1.65", fontSize: "0.9rem", fontFamily: "system-ui, sans-serif" }}>
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-16 md:py-24 px-5" style={{ background: theme.pageBg, transition: "background 0.3s" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10 md:mb-16">
            <p style={{ color: theme.accentSky, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "system-ui, sans-serif" }}>
              HOW IT WORKS
            </p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.75rem, 5vw, 3rem)", color: theme.heading }}>
              Four steps to your next adventure.
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {howItWorksSteps.map((s, i) => (
              <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background: theme.stepCircleBg, border: `1px solid ${theme.stepCircleBorder}` }}
                >
                  <span style={{ color: theme.accentSky, fontFamily: "'DM Serif Display', serif", fontSize: "0.95rem" }}>{s.step}</span>
                </div>
                <h4 style={{ fontFamily: "'DM Serif Display', serif", color: theme.heading, fontSize: "1.05rem", marginBottom: "0.4rem" }}>{s.title}</h4>
                <p style={{ color: theme.muted, fontSize: "0.82rem", lineHeight: "1.6", fontFamily: "system-ui, sans-serif" }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section id="destinations" className="py-16 md:py-24 px-5" style={{ background: theme.sectionAlt, transition: "background 0.3s" }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 md:mb-12">
            <p style={{ color: theme.accentSky, fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "system-ui, sans-serif" }}>
              POPULAR DESTINATIONS
            </p>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.75rem, 5vw, 3rem)", color: theme.heading }}>
              Where will you go next?
            </h2>
          </motion.div>

          {/* TODO: replace with API call — getDestinations() */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {destinations.map((d, i) => (
              <motion.div
                key={d.name}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                transition={{ delay: i * 0.07 }} whileHover={{ scale: 1.02 }}
                className="relative rounded-xl md:rounded-2xl overflow-hidden cursor-pointer"
                style={{ aspectRatio: "4/3" }}
              >
                <img src={d.img} alt={d.name} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${d.name}/600/400`; }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(5,13,26,0.85) 0%, transparent 55%)" }} />
                <div className="absolute bottom-3 left-3">
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", color: "#fff", fontSize: "1.1rem", lineHeight: 1 }}>{d.name}</h3>
                  <p style={{ color: "#B5D9EE", fontSize: "0.72rem", fontFamily: "system-ui, sans-serif" }}>{d.country}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-16 md:py-24 px-5" style={{ background: theme.pageBg, transition: "background 0.3s" }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl md:rounded-3xl p-8 md:p-16 text-center"
            style={{ background: theme.ctaBg, border: `1px solid ${theme.ctaBorder}` }}
          >
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "clamp(1.6rem, 5vw, 3rem)", color: theme.ctaHeading, marginBottom: "1rem" }}>
              Your next adventure is one quiz away.
            </h2>
            <p style={{ color: theme.ctaBody, marginBottom: "2rem", fontSize: "clamp(0.9rem, 2.5vw, 1.1rem)", fontFamily: "system-ui, sans-serif", maxWidth: "480px", margin: "0 auto 2rem" }}>
              Answer a few questions and let AI build a trip tailored to your style and budget.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={onStart}
              className="w-full sm:w-auto px-10 py-4 rounded-xl font-bold cursor-pointer"
              style={{ background: "#58ABD4", border: "none", fontSize: "1rem", fontFamily: "system-ui, sans-serif", color: "#0A1628" }}
            >
              Plan My Trip — It's Free
            </motion.button>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
