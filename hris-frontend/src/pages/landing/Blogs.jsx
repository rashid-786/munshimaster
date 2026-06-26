const BLOG_POSTS = [
  {
    title: 'The Future of HR: How Automation is Transforming People Operations',
    excerpt: 'Discover how AI and automation are reshaping the HR landscape, from payroll processing to employee engagement tracking.',
    date: 'Jun 12, 2026',
    author: 'Priya Sharma',
    readTime: '5 min read',
    tag: 'Trends',
  },
  {
    title: '10 Essential Features Every Modern Platform Should Have',
    excerpt: 'A comprehensive guide to evaluating HR platforms and understanding what features truly matter for your growing organization.',
    date: 'Jun 5, 2026',
    author: 'Rajesh Kumar',
    readTime: '7 min read',
    tag: 'Guide',
  },
  {
    title: 'Simplifying Payroll: From Manual Spreadsheets to Automated Systems',
    excerpt: 'How one company eliminated payroll errors and saved 15 hours per month by switching to an automated platform.',
    date: 'May 28, 2026',
    author: 'Amit Verma',
    readTime: '4 min read',
    tag: 'Case Study',
  },
  {
    title: 'Managing Remote Teams: Attendance Tracking Best Practices',
    excerpt: 'Learn effective strategies for tracking attendance and managing productivity across distributed and hybrid work environments.',
    date: 'May 20, 2026',
    author: 'Neha Patel',
    readTime: '6 min read',
    tag: 'Best Practices',
  },
  {
    title: 'A Complete Guide to Leave Management Policies',
    excerpt: 'Everything you need to know about designing, implementing, and managing leave policies that work for both employees and the organization.',
    date: 'May 14, 2026',
    author: 'Priya Sharma',
    readTime: '8 min read',
    tag: 'Guide',
  },
  {
    title: 'Why Your Business Needs a Centralized Supplier Management System',
    excerpt: 'Explore the benefits of moving from scattered spreadsheets to a centralized platform for managing vendors and purchase orders.',
    date: 'May 7, 2026',
    author: 'Rajesh Kumar',
    readTime: '5 min read',
    tag: 'Insights',
  },
];

export default function Blogs() {
  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Our Blog</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Insights, guides, and best practices for modern HR teams.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {BLOG_POSTS.map((post) => (
              <article key={post.title} className="group rounded-2xl border border-gray-100 bg-white overflow-hidden hover:shadow-lg hover:border-indigo-100 transition-all">
                <div className="h-48 bg-gradient-to-br from-indigo-100 to-indigo-50 flex items-center justify-center">
                  <svg className="w-12 h-12 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div className="p-6">
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 mb-3">
                    {post.tag}
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{post.author}</span>
                    <span>{post.date} &middot; {post.readTime}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
