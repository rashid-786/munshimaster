import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export default function CmsPage({ slug: propSlug }) {
  const { slug: paramSlug } = useParams();
  const slug = propSlug || paramSlug;
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    fetch(`${API_BASE}/public/cms/pages/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active) return;
        if (!data || !data.page) { setNotFound(true); return; }
        setPage(data.page);
        // SEO
        document.title = data.page.seoTitle || data.page.title;
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
        meta.content = data.page.seoDescription || '';
      })
      .catch(() => { if (active) setNotFound(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !page) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-bold text-gray-900">Page not found</h1>
        <p className="mt-2 text-gray-500">The page you are looking for doesn't exist or is unpublished.</p>
        <Link to="/" className="btn-primary mt-6 px-5 py-2.5">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      {page.featuredImage && (
        <img src={page.featuredImage} alt={page.title} className="w-full h-64 md:h-80 object-cover rounded-2xl mb-8" />
      )}
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{page.title}</h1>
      <div className="mt-6 cms-prose" dangerouslySetInnerHTML={{ __html: page.content }} />
    </div>
  );
}