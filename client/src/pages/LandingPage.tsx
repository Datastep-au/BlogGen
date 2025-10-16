import { useEffect } from 'react';
import { Link } from 'wouter';
import { Zap, Target, Users, RotateCcw, CheckCircle, Star, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  const { user } = useAuth();

  // Redirect to app if already authenticated
  useEffect(() => {
    if (user) {
      window.location.href = '/app';
    }
  }, [user]);

  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast Generation',
      description: 'Generate comprehensive, SEO-optimised articles in under 30 seconds. No more writer\'s block or hours of research.',
      color: 'text-white',
      bgColor: 'bg-blue-500',
    },
    {
      icon: Target,
      title: 'SEO Optimised',
      description: 'Every article includes optimised titles, meta descriptions, and naturally integrated keywords for better search rankings.',
      color: 'text-white',
      bgColor: 'bg-purple-500',
    },
    {
      icon: Users,
      title: 'Professional Quality',
      description: 'AI-generated content that maintains a professional tone whilst being engaging and informative for your audience.',
      color: 'text-white',
      bgColor: 'bg-green-600',
    },
    {
      icon: RotateCcw,
      title: 'Bulk Generation',
      description: 'Generate multiple articles at once. Perfect for content calendars and large-scale content marketing campaigns.',
      color: 'text-white',
      bgColor: 'bg-orange-500',
    },
    {
      icon: CheckCircle,
      title: 'Easy Editing',
      description: 'Built-in editor allows you to refine and customise your articles. Copy content with one click for easy publishing.',
      color: 'text-white',
      bgColor: 'bg-purple-500',
    },
    {
      icon: Star,
      title: 'Status Management',
      description: 'Track your articles through draft, approved, scheduled, and published stages with our intuitive dashboard.',
      color: 'text-white',
      bgColor: 'bg-pink-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 fixed w-full z-50 top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <img 
                  src="/BlogGen_Pro_Logo.png" 
                  alt="BlogGen Pro" 
                  className="w-28 h-28"
                />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/auth">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="pt-16">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-20 sm:py-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Create SEO-Optimized{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Blog Articles
                </span>{' '}
                in Seconds
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Generate professional, search-engine optimized blog content with AI. Perfect titles, meta descriptions, and structured content that ranks well and engages readers.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/auth">
                  <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:-translate-y-1 transition-all duration-300">
                    Start Creating Articles
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="hover:shadow-lg transition-all duration-300"
                  onClick={() => window.open('https://www.youtube.com/watch?v=mQBpeURNsLc', '_blank')}
                >
                  Watch Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Everything You Need for SEO Success</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Our AI-powered platform provides all the tools you need to create high-quality, search-engine optimised content.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300"
                >
                  <div className={`w-12 h-12 ${feature.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Get from idea to published article in just three simple steps.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Enter Your Topic</h3>
                <p className="text-gray-600">
                  Simply type in your article topic or upload multiple topics for bulk generation. Our AI understands context and intent.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Generates Content</h3>
                <p className="text-gray-600">
                  Our advanced AI creates a comprehensive article with proper structure, SEO optimisation, and engaging content in seconds.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Edit & Publish</h3>
                <p className="text-gray-600">
                  Review, edit if needed, and copy your content. Manage article status and track your content pipeline with ease.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Content Strategy?</h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join thousands of content creators who are scaling their blogs with AI-powered article generation.
            </p>
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100 transform hover:-translate-y-1 transition-all duration-300">
                Start Your Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
