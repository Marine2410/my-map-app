"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

// Typ für einen Ort (entspricht der Supabase-Tabelle "places")
type Place = {
  id: number; // kommt aus der Spalte "uuid"
  title: string;
  category: string | null;
  description: string | null;
  address: string | null;
  lat: number;
  lng: number;
  image_url: string | null; // Cover-Bild
  image_urls: string[] | null; // Galerie
  region: string | null;
  price_level: string | null;
  laptop_friendly: boolean | null;
  time_of_day: string | null;
  tags: string[] | null;
  created_at?: string;
};

// Für die dynamisch geladenen Leaflet-Module
type ReactLeafletModule = typeof import("react-leaflet");

type MarkerIcons = {
  cafe: any;
  restaurant: any;
  shopping: any;
  matcha: any;
  activities: any;
  other: any;
};

type ClusterComponent = React.ComponentType<any>;

export default function HomePage() {
  const [reactLeaflet, setReactLeaflet] = useState<ReactLeafletModule | null>(
    null
  );
  const [markerIcons, setMarkerIcons] = useState<MarkerIcons | null>(null);
  const [MarkerClusterGroup, setMarkerClusterGroup] =
    useState<ClusterComponent | null>(null);

  const [places, setPlaces] = useState<Place[]>([]);

  // Formular-State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [selectedLat, setSelectedLat] = useState<number | null>(null);
  const [selectedLng, setSelectedLng] = useState<number | null>(null);

  // Zusatzfelder
  const [region, setRegion] = useState("");
  const [priceLevel, setPriceLevel] = useState("");
  const [laptopFriendly, setLaptopFriendly] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState("");

  // Tags
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  // Bilder (mehrere)
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // UI-States
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchText, setSearchText] = useState("");
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>("all");
  const [filterPrice, setFilterPrice] = useState<string>("all");
  const [filterTimeOfDay, setFilterTimeOfDay] = useState<string>("all");
  const [filterLaptopFriendly, setFilterLaptopFriendly] =
    useState<boolean>(false);
  const [activeTag, setActiveTag] = useState<string>("all");

  // Edit-Mode
  const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null);

  // Mobile / Layout
  const [isMobile, setIsMobile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // react-leaflet, leaflet & Cluster nur im Browser laden
  useEffect(() => {
    (async () => {
      const [reactLeafletMod, leafletMod, clusterMod] = await Promise.all([
        import("react-leaflet"),
        import("leaflet"),
        import("react-leaflet-cluster"),
      ]);
      setReactLeaflet(reactLeafletMod);
      setMarkerClusterGroup(() => clusterMod.default);

      const { icon } = leafletMod;

      // Custom Marker-Icons (farbige Pins)
      const createIcon = (url: string) =>
        icon({
          iconUrl: url,
          iconSize: [32, 52],
          iconAnchor: [16, 52],
          popupAnchor: [0, -46],
          className: "map-category-icon",
        });

      setMarkerIcons({
        cafe: createIcon(
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png"
        ),
        restaurant: createIcon(
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png"
        ),
        shopping: createIcon(
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png"
        ),
        matcha: createIcon(
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png"
        ),
        activities: createIcon(
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png"
        ),
        other: createIcon(
          "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png"
        ),
      });
    })();
  }, []);

  // Mobile-Breakpoint erkennen
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => {
      const mobile = window.innerWidth < 768; // < 768px = "mobile"
      setIsMobile(mobile);
    };

    handleResize(); // direkt beim Laden einmal prüfen
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Sidebar-Standardzustand abhängig vom Layout
  useEffect(() => {
    // Auf Desktop: Sidebar offen, auf Mobile: erstmal zu
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Orte aus Supabase laden
  useEffect(() => {
    const fetchPlaces = async () => {
      setIsLoadingPlaces(true);
      setErrorMessage(null);

      const { data, error } = await supabase
        .from("places")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fehler beim Laden der Orte:", error);
        setErrorMessage("Fehler beim Laden der Orte.");
      } else if (data) {
        const mapped = data.map((row: any) => {
          let imageUrls: string[] | null = null;
          let tagsArr: string[] | null = null;

          try {
            if (row.image_urls) {
              imageUrls = JSON.parse(row.image_urls as string);
            } else if (row.image_url) {
              imageUrls = [row.image_url as string];
            }
          } catch {
            imageUrls = row.image_url ? [row.image_url as string] : null;
          }

          try {
            if (row.tags) {
              tagsArr = JSON.parse(row.tags as string);
            }
          } catch {
            tagsArr = null;
          }

          return {
            ...row,
            id: row.uuid,
            lat: Number(row.lat),
            lng: Number(row.lng),
            image_urls: imageUrls,
            tags: tagsArr,
          } as Place;
        });
        setPlaces(mapped);
      }

      setIsLoadingPlaces(false);
    };

    fetchPlaces();
  }, []);

  // Solange Map libs noch nicht geladen sind
  if (!reactLeaflet || !markerIcons || !MarkerClusterGroup) {
    return (
      <div
        style={{
          padding: "2rem",
          backgroundColor: "#020617",
          color: "#e5e7eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Karte wird geladen…
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } =
    reactLeaflet;

  // Klick-Handler auf der Karte
  function MapClickHandler(props: {
    onMapClick: (lat: number, lng: number) => void;
  }) {
    useMapEvents({
      click(e) {
        props.onMapClick(e.latlng.lat, e.latlng.lng);
      },
    });
    return null;
  }

  // Smooth Recenter mit flyTo
  function RecenterOnSelected(props: { lat: number; lng: number }) {
    const map = useMap();

    useEffect(() => {
      map.flyTo([props.lat, props.lng], 13, {
        animate: true,
        duration: 0.8,
      });
    }, [props.lat, props.lng, map]);

    return null;
  }

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
  };

  // Geocoding
  const handleGeocode = async () => {
    if (!address.trim()) {
      alert("Bitte zuerst eine Adresse eingeben.");
      return;
    }

    try {
      setIsGeocoding(true);
      setErrorMessage(null);

      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        address
      )}&format=json&limit=1`;

      const res = await fetch(url, {
        headers: {
          "Accept-Language": "de",
        },
      });

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        alert("Keine Koordinaten für diese Adresse gefunden.");
        return;
      }

      const first = data[0];
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);

      setSelectedLat(lat);
      setSelectedLng(lng);
    } catch (err) {
      console.error("Fehler beim Geocoding:", err);
      setErrorMessage("Fehler beim Geocoding – bitte später erneut versuchen.");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setImageFiles([]);
      setImagePreviews([]);
      return;
    }

    const fileArray = Array.from(files);
    setImageFiles(fileArray);

    const previews: string[] = [];
    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          previews.push(reader.result);
          if (previews.length === fileArray.length) {
            setImagePreviews(previews);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // Kategorie → Icon
  const getIconForCategory = (cat: string | null | undefined) => {
    const c = (cat || "").toLowerCase();
    if (c.includes("matcha")) return markerIcons!.matcha;
    if (c.includes("café") || c.includes("cafe") || c.includes("coffee"))
      return markerIcons!.cafe;
    if (c.includes("restaurant") || c.includes("essen") || c.includes("food"))
      return markerIcons!.restaurant;
    if (
      c.includes("shop") ||
      c.includes("shopping") ||
      c.includes("store") ||
      c.includes("einkauf")
    )
      return markerIcons!.shopping;
    if (
      c.includes("activity") ||
      c.includes("aktivität") ||
      c.includes("hiking") ||
      c.includes("walk") ||
      c.includes("museum")
    )
      return markerIcons!.activities;
    return markerIcons!.other;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (selectedLat === null || selectedLng === null) {
      alert(
        "Bitte zuerst auf die Karte klicken oder die Adresse auf der Karte setzen."
      );
      return;
    }

    if (!title.trim()) {
      alert("Bitte einen Titel eingeben.");
      return;
    }

    setIsSaving(true);

    // vorhandene Bilder bei Edit behalten
    let existingImageUrls: string[] = [];
    if (editingPlaceId != null) {
      const existing = places.find((p) => p.id === editingPlaceId);
      if (existing?.image_urls) {
        existingImageUrls = [...existing.image_urls];
      }
    }

    let newUploadedUrls: string[] = [];

    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        try {
          const ext = file.name.split(".").pop();
          const fileName = `${Date.now()}_${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;
          const filePath = `places/${fileName}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("place-images")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Fehler beim Upload eines Bildes:", uploadError);
            setErrorMessage("Fehler beim Hochladen eines oder mehrerer Bilder.");
            continue;
          }

          if (uploadData) {
            const { data: publicData } = supabase.storage
              .from("place-images")
              .getPublicUrl(uploadData.path);
            if (publicData?.publicUrl) {
              newUploadedUrls.push(publicData.publicUrl);
            }
          }
        } catch (err) {
          console.error("Unerwarteter Fehler beim Bild-Upload:", err);
          setErrorMessage("Unerwarteter Fehler beim Bild-Upload.");
        }
      }
    }

    const finalImageUrls =
      existingImageUrls.length > 0 || newUploadedUrls.length > 0
        ? [...existingImageUrls, ...newUploadedUrls]
        : [];

    const firstImage =
      finalImageUrls.length > 0 ? finalImageUrls[0] : null;

    const baseData = {
      title: title.trim(),
      category: category.trim() || null,
      description: description.trim() || null,
      address: address.trim() || null,
      lat: selectedLat,
      lng: selectedLng,
      image_url: firstImage,
      image_urls:
        finalImageUrls.length > 0 ? JSON.stringify(finalImageUrls) : null,
      region: region.trim() || null,
      price_level: priceLevel.trim() || null,
      laptop_friendly: laptopFriendly,
      time_of_day: timeOfDay.trim() || null,
      tags: tags.length > 0 ? JSON.stringify(tags) : null,
    };

    if (editingPlaceId != null) {
      // UPDATE
      const { data, error } = await supabase
        .from("places")
        .update(baseData)
        .eq("uuid", editingPlaceId)
        .select()
        .single();

      if (error) {
        console.error("Fehler beim Aktualisieren des Ortes:", error);
        setErrorMessage("Fehler beim Aktualisieren des Ortes.");
        setIsSaving(false);
        return;
      }

      if (data) {
        let urls: string[] | null = null;
        let tagsArr: string[] | null = null;
        try {
          if (data.image_urls) {
            urls = JSON.parse(data.image_urls as string);
          } else if (data.image_url) {
            urls = [data.image_url as string];
          }
        } catch {
          urls = data.image_url ? [data.image_url as string] : null;
        }

        try {
          if (data.tags) {
            tagsArr = JSON.parse(data.tags as string);
          }
        } catch {
          tagsArr = null;
        }

        const updatedPlace: Place = {
          ...data,
          id: data.uuid,
          lat: Number(data.lat),
          lng: Number(data.lng),
          image_urls: urls,
          tags: tagsArr,
        };

        setPlaces((prev) =>
          prev.map((p) => (p.id === editingPlaceId ? updatedPlace : p))
        );
      }
    } else {
      // INSERT
      const { data, error } = await supabase
        .from("places")
        .insert(baseData)
        .select()
        .single();

      if (error) {
        console.error("Fehler beim Speichern des Ortes:", error);
        setErrorMessage("Fehler beim Speichern des Ortes.");
        setIsSaving(false);
        return;
      }

      if (data) {
        let urls: string[] | null = null;
        let tagsArr: string[] | null = null;
        try {
          if (data.image_urls) {
            urls = JSON.parse(data.image_urls as string);
          } else if (data.image_url) {
            urls = [data.image_url as string];
          }
        } catch {
          urls = data.image_url ? [data.image_url as string] : null;
        }

        try {
          if (data.tags) {
            tagsArr = JSON.parse(data.tags as string);
          }
        } catch {
          tagsArr = null;
        }

        const savedPlace: Place = {
          ...data,
          id: data.uuid,
          lat: Number(data.lat),
          lng: Number(data.lng),
          image_urls: urls,
          tags: tagsArr,
        };
        setPlaces((prev) => [savedPlace, ...prev]);
      }
    }

    resetForm();
    setIsSaving(false);
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setDescription("");
    setAddress("");
    setSelectedLat(null);
    setSelectedLng(null);
    setImageFiles([]);
    setImagePreviews([]);
    setRegion("");
    setPriceLevel("");
    setLaptopFriendly(false);
    setTimeOfDay("");
    setTags([]);
    setTagInput("");
    setEditingPlaceId(null);
  };

  const handleEditPlace = (place: Place) => {
    setEditingPlaceId(place.id);
    setTitle(place.title);
    setCategory(place.category || "");
    setDescription(place.description || "");
    setAddress(place.address || "");
    setSelectedLat(place.lat);
    setSelectedLng(place.lng);
    setRegion(place.region || "");
    setPriceLevel(place.price_level || "");
    setLaptopFriendly(Boolean(place.laptop_friendly));
    setTimeOfDay(place.time_of_day || "");
    setTags(place.tags || []);
    setTagInput("");
    setImageFiles([]);
    setImagePreviews([]);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setIsSidebarOpen(true);
  };

  const handleCancelEdit = () => {
    resetForm();
  };

  const handleDeletePlace = async (id: number) => {
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm("Möchtest du diesen Ort wirklich löschen?");
    if (!ok) return;

    const { error } = await supabase.from("places").delete().eq("uuid", id);

    if (error) {
      console.error("Fehler beim Löschen des Ortes:", error);
      setErrorMessage("Fehler beim Löschen des Ortes.");
      return;
    }

    setPlaces((prev) => prev.filter((p) => p.id !== id));

    if (editingPlaceId === id) {
      resetForm();
    }
  };

  const categories = Array.from(
    new Set(
      places.map((p) =>
        p.category && p.category.trim() !== "" ? p.category : "Sonstiges"
      )
    )
  );

  const regions = Array.from(
    new Set(
      places
        .map((p) =>
          p.region && p.region.trim() !== "" ? p.region : null
        )
        .filter((x): x is string => x !== null)
    )
  );

  const priceLevels = Array.from(
    new Set(
      places
        .map((p) =>
          p.price_level && p.price_level.trim() !== ""
            ? p.price_level
            : null
        )
        .filter((x): x is string => x !== null)
    )
  );

  const timesOfDay = Array.from(
    new Set(
      places
        .map((p) =>
          p.time_of_day && p.time_of_day.trim() !== ""
            ? p.time_of_day
            : null
        )
        .filter((x): x is string => x !== null)
    )
  );

  const tagOptions = Array.from(new Set(places.flatMap((p) => p.tags ?? [])));

  const filteredPlaces = places.filter((p) => {
    if (activeCategory !== "all") {
      const cat =
        p.category && p.category.trim() !== "" ? p.category : "Sonstiges";
      if (cat !== activeCategory) return false;
    }

    if (filterRegion !== "all") {
      const reg =
        p.region && p.region.trim() !== "" ? p.region : "Unbekannt";
      if (reg !== filterRegion) return false;
    }

    if (filterPrice !== "all") {
      const pl =
        p.price_level && p.price_level.trim() !== ""
          ? p.price_level
          : "Unbekannt";
      if (pl !== filterPrice) return false;
    }

    if (filterTimeOfDay !== "all") {
      const tod =
        p.time_of_day && p.time_of_day.trim() !== ""
          ? p.time_of_day
          : "Unbekannt";
      if (tod !== filterTimeOfDay) return false;
    }

    if (filterLaptopFriendly && !p.laptop_friendly) {
      return false;
    }

    if (onlyWithImages && (!p.image_urls || p.image_urls.length === 0)) {
      return false;
    }

    if (activeTag !== "all") {
      if (!p.tags || !p.tags.includes(activeTag)) return false;
    }

    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      const inTitle = p.title.toLowerCase().includes(s);
      const inDesc = (p.description || "").toLowerCase().includes(s);
      const inAddr = (p.address || "").toLowerCase().includes(s);
      const inCat = (p.category || "").toLowerCase().includes(s);
      const inRegion = (p.region || "").toLowerCase().includes(s);
      const inTags = (p.tags || []).some((t) =>
        t.toLowerCase().includes(s)
      );

      if (
        !inTitle &&
        !inDesc &&
        !inAddr &&
        !inCat &&
        !inRegion &&
        !inTags
      ) {
        return false;
      }
    }

    return true;
  });

  const center: [number, number] =
    filteredPlaces.length > 0
      ? [filteredPlaces[0].lat, filteredPlaces[0].lng]
      : places.length > 0
      ? [places[0].lat, places[0].lng]
      : [47.5, 9.7]; // fallback: Mitteleuropa

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        width: "100vw",
        backgroundColor: "#020617",
        color: "#e5e7eb",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Sidebar Toggle-Button (Desktop + Mobile) */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen((prev) => !prev)}
        style={{
          position: "absolute",
          zIndex: 40,
          top: "0.75rem",
          right: "0.75rem",
          padding: "0.4rem 0.8rem",
          borderRadius: "999px",
          border: "1px solid rgba(148,163,184,0.5)",
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))",
          color: "#e5e7eb",
          fontSize: "0.8rem",
          cursor: "pointer",
          boxShadow: "0 10px 35px rgba(15,23,42,0.9)",
        }}
      >
        {isSidebarOpen ? "Karte anzeigen" : "Orte & Filter"}
      </button>

      {/* Linke Seite: Sidebar, scrollt separat / Desktop + Mobile-Overlay */}
      <div
        style={{
          padding: isSidebarOpen ? "1rem" : "0",
          overflowY: isSidebarOpen ? "auto" : "hidden",
          boxSizing: "border-box",
          background:
            "linear-gradient(180deg, #020617 0%, #020617 40%, #020617 100%)",
          borderRight:
            !isMobile && isSidebarOpen ? "1px solid #1f2937" : "none",
          width: isMobile
            ? "100%"
            : isSidebarOpen
            ? "34%"
            : "0",
          height: "100vh",
          position: isMobile ? "absolute" : "relative",
          top: isMobile ? 0 : undefined,
          left: isMobile ? (isSidebarOpen ? 0 : "-100%") : undefined,
          right: isMobile ? 0 : undefined,
          bottom: isMobile ? 0 : undefined,
          zIndex: isMobile ? 30 : 1,
          transition: isMobile
            ? "left 0.25s ease-out"
            : "width 0.25s ease-out, padding 0.25s ease-out",
          boxShadow: isMobile
            ? "10px 0 40px rgba(15,23,42,0.95)"
            : "none",
        }}
      >
        {isSidebarOpen && (
          <>
            <h1
              style={{
                marginBottom: "0.2rem",
                fontSize: "1.25rem",
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              Meine Weltkarte
            </h1>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#9ca3af",
                marginBottom: "0.6rem",
              }}
            >
              Deine persönliche Mapstr-Alternative – mit Dark Mode, Kategorien,
              Bildern, Tags & Filtern.
            </p>

            {editingPlaceId != null && (
              <div
                style={{
                  marginBottom: "0.5rem",
                  padding: "0.45rem 0.7rem",
                  borderRadius: "0.75rem",
                  background:
                    "linear-gradient(135deg, rgba(30,64,175,0.25), rgba(8,47,73,0.65))",
                  fontSize: "0.85rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid rgba(59,130,246,0.4)",
                }}
              >
                <span>Bearbeitungsmodus: Ort wird aktualisiert.</span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    border: "none",
                    background: "#020617",
                    color: "#e5e7eb",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "999px",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    borderColor: "#4b5563",
                    borderWidth: 1,
                    borderStyle: "solid",
                  }}
                >
                  Abbrechen
                </button>
              </div>
            )}

            {errorMessage && (
              <div
                style={{
                  marginBottom: "0.75rem",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "#7f1d1d",
                  color: "#fee2e2",
                  fontSize: "0.85rem",
                  border: "1px solid #b91c1c",
                }}
              >
                {errorMessage}
              </div>
            )}

            {/* Formular */}
            <form
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                marginBottom: "1rem",
                padding: "0.9rem",
                borderRadius: "0.9rem",
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.99))",
                border: "1px solid rgba(148,163,184,0.24)",
                boxShadow: "0 20px 60px rgba(15,23,42,0.9)",
              }}
            >
              <label style={{ fontSize: "0.8rem" }}>
                Titel
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z.B. Bestes Café in Wien"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                  }}
                />
              </label>

              <label style={{ fontSize: "0.8rem" }}>
                Kategorie
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="z.B. Café, Restaurant, Matcha, Shopping..."
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                  }}
                />
              </label>

              <label style={{ fontSize: "0.8rem" }}>
                Region
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="z.B. Vorarlberg, Wien, Europa, Asien..."
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                  }}
                />
              </label>

              <label style={{ fontSize: "0.8rem" }}>
                Preislevel
                <input
                  type="text"
                  value={priceLevel}
                  onChange={(e) => setPriceLevel(e.target.value)}
                  placeholder="z.B. €, €€, €€€"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                  }}
                />
              </label>

              <label style={{ fontSize: "0.8rem" }}>
                Tageszeit
                <input
                  type="text"
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value)}
                  placeholder="z.B. Frühstück, Brunch, Dinner, Drinks..."
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                  }}
                />
              </label>

              <label
                style={{
                  fontSize: "0.8rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  color: "#e5e7eb",
                }}
              >
                <input
                  type="checkbox"
                  checked={laptopFriendly}
                  onChange={(e) => setLaptopFriendly(e.target.checked)}
                />
                Laptop-freundlich (gut zum Arbeiten)
              </label>

              <label style={{ fontSize: "0.8rem" }}>
                Adresse (für Geocoding)
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="z.B. Stephansplatz 1, Wien"
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                  }}
                />
              </label>

              <button
                type="button"
                onClick={handleGeocode}
                disabled={isGeocoding || !address.trim()}
                style={{
                  marginTop: "0.2rem",
                  padding: "0.45rem",
                  borderRadius: "999px",
                  border: "1px solid rgba(56,189,248,0.7)",
                  background: isGeocoding
                    ? "#1f2937"
                    : "linear-gradient(135deg,#0ea5e9,#22d3ee,#38bdf8)",
                  color: isGeocoding ? "#9ca3af" : "#020617",
                  cursor: isGeocoding ? "default" : "pointer",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                }}
              >
                {isGeocoding ? "Adresse wird gesucht…" : "Adresse auf Karte setzen"}
              </button>

              <label style={{ fontSize: "0.8rem" }}>
                Beschreibung
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deine Notizen, Blog-Text, Tipps..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.45rem",
                    marginTop: "0.2rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                    resize: "vertical",
                  }}
                />
              </label>

              {/* Tags */}
              <div style={{ fontSize: "0.8rem" }}>
                Tags (z.B. „vegan“, „cozy“, „date night“)
                <div
                  style={{
                    display: "flex",
                    gap: "0.4rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="z.B. vegan, cozy, rooftop..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "0.4rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #1f2937",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.8rem",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    style={{
                      padding: "0.4rem 0.7rem",
                      borderRadius: "999px",
                      border: "none",
                      background:
                        "linear-gradient(135deg,#22c55e,#4ade80,#a3e635)",
                      color: "#020617",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    Tag +
                  </button>
                </div>
                {tags.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.4rem",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.3rem",
                    }}
                  >
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.15rem 0.55rem",
                          borderRadius: "999px",
                          backgroundColor: "#0f172a",
                          border: "1px solid #1d4ed8",
                          fontSize: "0.75rem",
                          color: "#e5e7eb",
                        }}
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            fontSize: "0.8rem",
                            color: "#9ca3af",
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label style={{ fontSize: "0.8rem" }}>
                Bilder (optional, mehrere möglich)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  style={{
                    width: "100%",
                    marginTop: "0.3rem",
                    fontSize: "0.8rem",
                  }}
                />
              </label>

              {imagePreviews.length > 0 && (
                <div
                  style={{
                    marginTop: "0.3rem",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "0.25rem",
                  }}
                >
                  {imagePreviews.map((src, idx) => (
                    <img
                      key={idx}
                      src={src}
                      alt={`Preview ${idx + 1}`}
                      style={{
                        width: "100%",
                        height: "70px",
                        objectFit: "cover",
                        borderRadius: "0.55rem",
                        border: "1px solid #1f2937",
                      }}
                    />
                  ))}
                </div>
              )}

              <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                Gewählte Position:{" "}
                {selectedLat !== null && selectedLng !== null
                  ? `${selectedLat.toFixed(4)}, ${selectedLng.toFixed(4)}`
                  : "Noch keine – bitte auf die Karte klicken oder Adresse setzen."}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.4rem",
                }}
              >
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    padding: "0.6rem",
                    background: isSaving
                      ? "#1f2937"
                      : "linear-gradient(135deg,#2563eb,#22d3ee,#38bdf8)",
                    color: isSaving ? "#9ca3af" : "#020617",
                    border: "none",
                    borderRadius: "999px",
                    cursor: isSaving ? "default" : "pointer",
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    letterSpacing: "0.03em",
                  }}
                >
                  {isSaving
                    ? "Speichere..."
                    : editingPlaceId != null
                    ? "Ort aktualisieren"
                    : "Ort speichern"}
                </button>
                {editingPlaceId != null && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    style={{
                      padding: "0.6rem",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      borderRadius: "999px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      border: "1px solid #4b5563",
                      minWidth: "100px",
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>

            {/* Filter-Bereich */}
            <div
              style={{
                marginBottom: "0.75rem",
                padding: "0.75rem",
                borderRadius: "0.9rem",
                background:
                  "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.99))",
                border: "1px solid rgba(30,64,175,0.5)",
              }}
            >
              <div style={{ marginBottom: "0.5rem" }}>
                <div
                  style={{
                    fontSize: "0.8rem",
                    marginBottom: "0.25rem",
                    color: "#9ca3af",
                  }}
                >
                  Filter nach Kategorie:
                </div>
                <div
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveCategory("all")}
                    style={{
                      padding: "0.3rem 0.7rem",
                      borderRadius: "999px",
                      border:
                        activeCategory === "all"
                          ? "none"
                          : "1px solid #1f2937",
                      backgroundColor:
                        activeCategory === "all" ? "#0f172a" : "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Alle
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        padding: "0.3rem 0.7rem",
                        borderRadius: "999px",
                        border:
                          activeCategory === cat
                            ? "1px solid #2563eb"
                            : "1px solid #1f2937",
                        backgroundColor:
                          activeCategory === cat ? "#0f172a" : "#020617",
                        color: "#e5e7eb",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weitere Filter */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                  fontSize: "0.8rem",
                }}
              >
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Suche nach Titel, Beschreibung, Adresse, Tags..."
                  style={{
                    width: "100%",
                    padding: "0.4rem",
                    borderRadius: "0.55rem",
                    border: "1px solid #1f2937",
                    fontSize: "0.8rem",
                    backgroundColor: "#020617",
                    color: "#e5e7eb",
                  }}
                />

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    color: "#e5e7eb",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={onlyWithImages}
                    onChange={(e) => setOnlyWithImages(e.target.checked)}
                  />
                  Nur Orte mit Bildern
                </label>

                <label>
                  Region
                  <select
                    value={filterRegion}
                    onChange={(e) => setFilterRegion(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "0.15rem",
                      padding: "0.35rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #1f2937",
                      fontSize: "0.8rem",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                    }}
                  >
                    <option value="all">Alle</option>
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Preislevel
                  <select
                    value={filterPrice}
                    onChange={(e) => setFilterPrice(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "0.15rem",
                      padding: "0.35rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #1f2937",
                      fontSize: "0.8rem",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                    }}
                  >
                    <option value="all">Alle</option>
                    {priceLevels.map((pl) => (
                      <option key={pl} value={pl}>
                        {pl}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tageszeit
                  <select
                    value={filterTimeOfDay}
                    onChange={(e) => setFilterTimeOfDay(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "0.15rem",
                      padding: "0.35rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #1f2937",
                      fontSize: "0.8rem",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                    }}
                  >
                    <option value="all">Alle</option>
                    {timesOfDay.map((tod) => (
                      <option key={tod} value={tod}>
                        {tod}
                      </option>
                    ))}
                  </select>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    color: "#e5e7eb",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filterLaptopFriendly}
                    onChange={(e) => setFilterLaptopFriendly(e.target.checked)}
                  />
                  Nur laptopfreundliche Orte
                </label>

                <label>
                  Tags
                  <select
                    value={activeTag}
                    onChange={(e) => setActiveTag(e.target.value)}
                    style={{
                      width: "100%",
                      marginTop: "0.15rem",
                      padding: "0.35rem",
                      borderRadius: "0.55rem",
                      border: "1px solid #1f2937",
                      fontSize: "0.8rem",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                    }}
                  >
                    <option value="all">Alle</option>
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <h2
              style={{
                marginBottom: "0.5rem",
                fontSize: "1rem",
                fontWeight: 500,
                color: "#e5e7eb",
              }}
            >
              Gespeicherte Orte
            </h2>
            {isLoadingPlaces && (
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                Orte werden geladen...
              </p>
            )}
            {!isLoadingPlaces && filteredPlaces.length === 0 && (
              <p style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                Noch keine Orte, die zu den Filtern passen.
              </p>
            )}

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {filteredPlaces.map((place) => (
                <li
                  key={place.id}
                  style={{
                    marginBottom: "0.85rem",
                    padding: "0.75rem",
                    borderRadius: "0.9rem",
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.99))",
                    border: "1px solid rgba(31,41,55,0.9)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: "0.9rem" }}>
                        {place.title}
                      </strong>{" "}
                      {place.category && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            marginLeft: "0.25rem",
                            padding: "0.12rem 0.45rem",
                            borderRadius: "999px",
                            backgroundColor: "#0f172a",
                            color: "#e5e7eb",
                            border: "1px solid #1d4ed8",
                          }}
                        >
                          {place.category}
                        </span>
                      )}
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "#9ca3af",
                          marginTop: "0.15rem",
                        }}
                      >
                        {place.address}
                      </div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: "#e5e7eb",
                          marginTop: "0.2rem",
                        }}
                      >
                        {place.region && <>Region: {place.region} · </>}
                        {place.price_level && <>Preis: {place.price_level} · </>}
                        {place.time_of_day && (
                          <>Tageszeit: {place.time_of_day} · </>
                        )}
                        {place.laptop_friendly && <>Laptop-friendly ✅</>}
                      </div>
                      {place.tags && place.tags.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.25rem",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.25rem",
                            fontSize: "0.7rem",
                          }}
                        >
                          {place.tags.map((tag) => (
                            <span
                              key={tag}
                              style={{
                                padding: "0.1rem 0.5rem",
                                borderRadius: "999px",
                                backgroundColor: "#0f172a",
                                color: "#e5e7eb",
                                border: "1px solid #0ea5e9",
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {place.image_urls && place.image_urls.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.35rem",
                            display: "grid",
                            gridTemplateColumns: "repeat(3, 1fr)",
                            gap: "0.25rem",
                          }}
                        >
                          {place.image_urls.map((url, idx) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`${place.title} Bild ${idx + 1}`}
                              style={{
                                width: "100%",
                                height: "70px",
                                objectFit: "cover",
                                borderRadius: "0.55rem",
                                border: "1px solid #1f2937",
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "#6b7280",
                          marginTop: "0.25rem",
                        }}
                      >
                        {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        alignItems: "flex-end",
                      }}
                    >
                      <Link
                        href={`/places/${place.id}`}
                        style={{
                          padding: "0.25rem 0.55rem",
                          borderRadius: "999px",
                          border: "1px solid #22c55e",
                          background:
                            "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.25))",
                          color: "#bbf7d0",
                          fontSize: "0.75rem",
                          textDecoration: "none",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Details
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleEditPlace(place)}
                        style={{
                          padding: "0.25rem 0.55rem",
                          borderRadius: "999px",
                          border: "none",
                          backgroundColor: "#1d4ed8",
                          color: "white",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlace(place.id)}
                        style={{
                          padding: "0.25rem 0.55rem",
                          borderRadius: "999px",
                          border: "none",
                          backgroundColor: "#b91c1c",
                          color: "white",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* Mobile: Overlay über der Karte, wenn Sidebar offen */}
      {isMobile && isSidebarOpen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 10% 0, rgba(15,23,42,0.75), rgba(15,23,42,0.95))",
            zIndex: 20,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Rechte Seite: Karte */}
      <div
        style={{
          flex: 1,
          background:
            "radial-gradient(circle at 10% 0, #1e3a8a 0%, #020617 60%)",
        }}
      >
        <MapContainer
          center={center}
          zoom={4}
          minZoom={2}
          maxZoom={18}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution={
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
              '&copy; <a href="https://carto.com/attributions">CARTO</a>'
            }
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Klick-Handler */}
          <MapClickHandler onMapClick={handleMapClick} />

          {/* Smooth Recenter für ausgewählten Punkt */}
          {selectedLat !== null && selectedLng !== null && (
            <RecenterOnSelected lat={selectedLat} lng={selectedLng} />
          )}

          {/* Marker für aktuelle (noch nicht gespeicherte) Position */}
          {selectedLat !== null && selectedLng !== null && (
            <Marker
              position={[selectedLat, selectedLng]}
              icon={getIconForCategory(category)}
            >
              <Popup>
                <strong>
                  {editingPlaceId != null ? "Ort wird bearbeitet" : "Neuer Ort"}
                </strong>
                <br />
                Vervollständige das Formular{" "}
                {editingPlaceId != null
                  ? "und aktualisiere den Ort."
                  : "und speichere den Ort."}
              </Popup>
            </Marker>
          )}

          {/* Cluster für gespeicherte Orte */}
          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={60}
            showCoverageOnHover={false}
          >
            {filteredPlaces.map((place) => (
              <Marker
                key={place.id}
                position={[place.lat, place.lng]}
                icon={getIconForCategory(place.category)}
              >
                <Popup>
                  <div
                    style={{
                      fontSize: "0.85rem",
                      maxWidth: "230px",
                    }}
                  >
                    <strong>{place.title}</strong>
                    <br />
                    {place.category && (
                      <>
                        {place.category}
                        <br />
                      </>
                    )}
                    {place.address && (
                      <>
                        {place.address}
                        <br />
                      </>
                    )}
                    {place.region && (
                      <>
                        Region: {place.region}
                        <br />
                      </>
                    )}
                    {place.price_level && (
                      <>
                        Preis: {place.price_level}
                        <br />
                      </>
                    )}
                    {place.time_of_day && (
                      <>
                        Tageszeit: {place.time_of_day}
                        <br />
                      </>
                    )}
                    {place.laptop_friendly && (
                      <>
                        Laptop-freundlich ✅
                        <br />
                      </>
                    )}
                    {place.tags && place.tags.length > 0 && (
                      <>
                        Tags: {place.tags.join(", ")}
                        <br />
                      </>
                    )}

                    {place.image_urls && place.image_urls.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.4rem",
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: "0.25rem",
                        }}
                      >
                        {place.image_urls.slice(0, 2).map((url, idx) => (
                          <img
                            key={idx}
                            src={url}
                            alt={`${place.title} Bild ${idx + 1}`}
                            style={{
                              width: "100%",
                              height: "70px",
                              objectFit: "cover",
                              borderRadius: "0.4rem",
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: "0.5rem",
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Link
                        href={`/places/${place.id}`}
                        style={{
                          fontSize: "0.78rem",
                          color: "#38bdf8",
                          textDecoration: "none",
                          padding: "0.2rem 0.5rem",
                          borderRadius: "999px",
                          border: "1px solid rgba(56,189,248,0.5)",
                          backgroundColor: "rgba(15,23,42,0.8)",
                        }}
                      >
                        Details ansehen →
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}
