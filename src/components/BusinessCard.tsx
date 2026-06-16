import { useEffect, useRef } from "react";
import type Swiper from "swiper";
import "./BusinessCard.css";

interface Props {
  id?: string;
  title: string;
  images: string[];
  instagram?: string;
  facebook?: string;
  address?: string;
  phone?: string;
}

export default function BusinessCard({
  id,
  title,
  images,
  instagram,
  facebook,
  address,
  phone,
}: Props) {
  const swiperRef    = useRef<HTMLDivElement>(null);
  const prevRef      = useRef<HTMLDivElement>(null);
  const nextRef      = useRef<HTMLDivElement>(null);
  const paginRef     = useRef<HTMLDivElement>(null);
  const instanceRef  = useRef<Swiper | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!swiperRef.current || !prevRef.current || !nextRef.current) return;

      const { default: SwiperClass } = await import("swiper");
      const { Navigation, Pagination } = await import("swiper/modules");

      if (!isMounted) return;

      // Destroy any previous instance just in case
      instanceRef.current?.destroy(true, true);

      instanceRef.current = new SwiperClass(swiperRef.current, {
        modules: [Navigation, Pagination],
        slidesPerView: 1,
        loop: images.length > 1,
        navigation: {
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        },
        pagination: paginRef.current
          ? { el: paginRef.current, clickable: true }
          : false,
      });
    }

    init();

    return () => {
      isMounted = false;
      instanceRef.current?.destroy(true, true);
      instanceRef.current = null;
    };
  }, [images]);

  return (
    <div className="business-card" id={id}>
      <div className="business-card-slider">
        <div className="swiper js-business-swiper" ref={swiperRef}>
          <div className="swiper-wrapper">
            {images.map((img, i) => (
              <div className="swiper-slide" key={i}>
                <img src={img} alt={title} loading="lazy" />
              </div>
            ))}
          </div>
          {/* Flechas de navegación — refs directos */}
          <div ref={prevRef} className="swiper-button-prev" />
          <div ref={nextRef} className="swiper-button-next" />

          {/* Paginación */}
          <div ref={paginRef} className="swiper-pagination" />
        </div>
      </div>

      <div className="business-card-content">
        <h3 className="business-card-title">{title}</h3>
        <ul className="business-card-info">
          {instagram && (
            <li>
              <a
                href={instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
              >
                <div className="icon">
                  <svg
                    viewBox="0 0 448 512"
                    width="20"
                    height="20"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="ig-grad-card"
                        x1="0%"
                        y1="100%"
                        x2="100%"
                        y2="0%"
                      >
                        <stop offset="0%" stopColor="#fdf497" />
                        <stop offset="5%" stopColor="#fdf497" />
                        <stop offset="45%" stopColor="#fd5949" />
                        <stop offset="60%" stopColor="#d6249f" />
                        <stop offset="90%" stopColor="#285AEB" />
                      </linearGradient>
                    </defs>
                    <path
                      fill="url(#ig-grad-card)"
                      d="M224.1 141c-63.6 0-114.9 51.3-114.9 114.9s51.3 114.9 114.9 114.9S339 319.5 339 255.9 287.7 141 224.1 141zm0 189.6c-41.1 0-74.7-33.5-74.7-74.7s33.5-74.7 74.7-74.7 74.7 33.5 74.7 74.7-33.6 74.7-74.7 74.7zm146.4-194.3c0 14.9-12 26.8-26.8 26.8-14.9 0-26.8-12-26.8-26.8s12-26.8 26.8-26.8 26.8 12 26.8 26.8zm76.1 27.2c-1.7-35.9-9.9-67.7-36.2-93.9-26.2-26.2-58-34.4-93.9-36.2-37-2.1-147.9-2.1-184.9 0-35.8 1.7-67.6 9.9-93.9 36.1s-34.4 58-36.2 93.9c-2.1 37-2.1 147.9 0 184.9 1.7 35.9 9.9 67.7 36.2 93.9s58 34.4 93.9 36.2c37 2.1 147.9 2.1 184.9 0 35.9-1.7 67.7-9.9 93.9-36.2 26.2-26.2 34.4-58 36.2-93.9 2.1-37 2.1-147.8 0-184.8zM398.8 388c-7.8 19.6-22.9 34.7-42.6 42.6-29.5 11.7-99.5 9-132.1 9s-102.7 2.6-132.1-9c-19.6-7.8-34.7-22.9-42.6-42.6-11.7-29.5-9-99.5-9-132.1s-2.6-102.7 9-132.1c7.8-19.6 22.9-34.7 42.6-42.6 29.5-11.7 99.5-9 132.1-9s102.7-2.6 132.1 9c19.6 7.8 34.7 22.9 42.6 42.6 11.7 29.5 9 99.5 9 132.1s2.7 102.7-9 132.1z"
                    />
                  </svg>
                </div>
                <span>{title}</span>
              </a>
            </li>
          )}
          {facebook && (
            <li>
              <a
                href={facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
              >
                <div className="icon">
                  <svg
                    viewBox="0 0 448 512"
                    width="20"
                    height="20"
                    aria-hidden="true"
                    className="icon--facebook"
                  >
                    <path
                      fill="currentColor"
                      d="M400 32H48A48 48 0 0 0 0 80v352a48 48 0 0 0 48 48h137.25V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.27c-30.81 0-40.42 19.12-40.42 38.73V256h68.78l-11 71.69h-57.78V480H400a48 48 0 0 0 48-48V80a48 48 0 0 0-48-48z"
                    />
                  </svg>
                </div>
                <span>{title}</span>
              </a>
            </li>
          )}
          {address && (
            <li>
              <div className="icon">
                <svg
                  viewBox="0 0 384 512"
                  width="18"
                  height="18"
                  aria-hidden="true"
                  className="icon--location"
                >
                  <path
                    fill="currentColor"
                    d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"
                  />
                </svg>
              </div>
              <span>{address}</span>
            </li>
          )}
        </ul>

        <div className="business-card-phone">
          <strong>Teléfono:</strong> {phone ?? ""}
        </div>
      </div>

    </div>
  );
}
