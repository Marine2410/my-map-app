"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type Place = {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  address: string | null;
  lat: number;
  lng: number;
  image_url: string | null;
  image_urls: string[] | null;
  region: string | null;
  price_level: string | null;
  laptop_friendly: boolean | null;
  time_of_day: string | null;
  tags: string[] | null;
  created_at?: string;
};

export default function PlaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id as string | undefined;

  const [place, setPlace] = useState<Place | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!idParam) {
      setErrorMessage("Keine ID in der URL gefunden.");
      setIsLoading(false);
      return;
    }

    const numericId = Number(idParam);
    if (Number.isNaN(numericId)) {
      setErrorMessage("Ungültige ID.");
      setIsLoading(false);
      return;
    }

    const fetchPlace = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("places")
        .select("*")
        .eq("uuid", numericId)
        .single();

      if (error) {
        console.error("Fehler beim Laden des Ortes:", error);
        setErrorMessage("Ort konnte nicht geladen werden.");
        setIsLoading(false);
        return;
      }

      if (!data) {
        setErrorMessage("Ort nicht gefunden.");
        setIsLoading(false);
        return;
      }

      let imageUrls: string[] | null = null;
      let tagsArr: string[] | null = null;

      try {
        if (data.image_urls) {
          imageUrls = JSON.parse(data.image_urls as string);
        } else if (data.image_url) {
          imageUrls = [data.image_url as string];
        }
      } catch {
        imageUrls = data.image_url ? [data.image_url as string] : null;
      }

      try {
        if (data.tags) {
          tagsArr = JSON.parse(data.tags as string);
        }
      } catch {
        tagsArr = null;
      }

      const mapped: Place = {
        ...data,
        id: data.uuid,
        lat: Number(data.lat),
        lng: Number(data.lng),
        image_urls: imageUrls,
        tags: tagsArr,
      };

      setPlace(mapped);
      setIsLoading(false);
    };

    fetchPlace();
  }, [idParam]);

  const handleBack = () => {
    router.push("/");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "1.5rem",
        backgroundColor: "#020617",
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
        }}
      >
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <button
            type="button"
            onClick={handleBack}
            style={{
              borderRadius: "999px",
              border: "1px solid #1f2937",
              backgroundColor: "#020617",
              color: "#e5e7eb",
              padding: "0.35rem 0.9rem",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            ← Zurück zur Karte
          </button>
          <span
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            Detailansicht
          </span>
        </div>

        {/* Lade- / Fehler-Status */}
        {isLoading && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              backgroundColor: "#020617",
              border: "1px solid #1f2937",
              color: "#9ca3af",
              fontSize: "0.9rem",
            }}
          >
            Ort wird geladen...
          </div>
        )}

        {!isLoading && errorMessage && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "0.75rem",
              backgroundColor: "#7f1d1d",
              border: "1px solid #b91c1c",
              color: "#fee2e2",
              fontSize: "0.9rem",
            }}
          >
            {errorMessage}
          </div>
        )}

        {!isLoading && place && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
              gap: "1.25rem",
              alignItems: "flex-start",
            }}
          >
            {/* Linke Seite: Infos & Text */}
            <div
              style={{
                padding: "1.1rem",
                borderRadius: "1rem",
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,1))",
                border: "1px solid rgba(148,163,184,0.2)",
                boxShadow: "0 20px 60px rgba(15,23,42,0.9)",
              }}
            >
              <h1
                style={{
                  marginTop: 0,
                  marginBottom: "0.4rem",
                  fontSize: "1.4rem",
                  fontWeight: 600,
                }}
              >
                {place.title}
              </h1>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.4rem",
                  marginBottom: "0.6rem",
                }}
              >
                {place.category && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                      backgroundColor: "#0f172a",
                      border: "1px solid #1d4ed8",
                    }}
                  >
                    {place.category}
                  </span>
                )}
                {place.region && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                    }}
                  >
                    Region: {place.region}
                  </span>
                )}
                {place.price_level && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                    }}
                  >
                    Preis: {place.price_level}
                  </span>
                )}
                {place.time_of_day && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                      backgroundColor: "#020617",
                      border: "1px solid #1f2937",
                    }}
                  >
                    Tageszeit: {place.time_of_day}
                  </span>
                )}
                {place.laptop_friendly && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.6rem",
                      borderRadius: "999px",
                      backgroundColor: "#022c22",
                      border: "1px solid #16a34a",
                    }}
                  >
                    Laptop-freundlich ✅
                  </span>
                )}
              </div>

              {place.address && (
                <p
                  style={{
                    marginTop: 0,
                    marginBottom: "0.4rem",
                    fontSize: "0.9rem",
                    color: "#9ca3af",
                  }}
                >
                  📍 {place.address}
                </p>
              )}

              {place.tags && place.tags.length > 0 && (
                <div
                  style={{
                    marginBottom: "0.75rem",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.35rem",
                  }}
                >
                  {place.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.6rem",
                        borderRadius: "999px",
                        backgroundColor: "#0f172a",
                        border: "1px solid #0ea5e9",
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  marginBottom: "0.75rem",
                }}
              >
                Koordinaten: {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
              </div>

              <h2
                style={{
                  marginTop: "0.6rem",
                  marginBottom: "0.35rem",
                  fontSize: "1rem",
                }}
              >
                Notizen & Beschreibung
              </h2>
              <p
                style={{
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  color: "#e5e7eb",
                  whiteSpace: "pre-wrap",
                }}
              >
                {place.description
                  ? place.description
                  : "Noch keine Beschreibung hinzugefügt – du kannst in deiner Hauptansicht Text ergänzen und den Ort bearbeiten."}
              </p>
            </div>

            {/* Rechte Seite: Bilder / Galerie */}
            <div
              style={{
                padding: "1rem",
                borderRadius: "1rem",
                background:
                  "radial-gradient(circle at 10% 0, #1e3a8a 0%, #020617 60%)",
                border: "1px solid rgba(30,64,175,0.7)",
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                  marginBottom: "0.5rem",
                  fontSize: "1rem",
                }}
              >
                Galerie
              </h2>

              {place.image_urls && place.image_urls.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                    gap: "0.5rem",
                  }}
                >
                  {place.image_urls.map((url, idx) => (
                    <div
                      key={idx}
                      style={{
                        borderRadius: "0.75rem",
                        overflow: "hidden",
                        border: "1px solid rgba(15,23,42,0.9)",
                        backgroundColor: "#020617",
                      }}
                    >
                      <img
                        src={url}
                        alt={`${place.title} Bild ${idx + 1}`}
                        style={{
                          width: "100%",
                          height: "160px",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontSize: "0.85rem",
                    color: "#cbd5f5",
                  }}
                >
                  Noch keine Bilder gespeichert. Du kannst in deiner Map-Ansicht
                  Bilder hochladen und speichern.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
