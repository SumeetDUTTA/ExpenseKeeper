import React, {useState, useRef} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import emailjs from '@emailjs/browser';

import { useAuth } from '../contexts/authContext';
import '../styles/homePage.css';

export default function HomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef();

  // Wake up backend server on Render
  React.useEffect(() => {
    const wakeBackend = async () => {
      try {
        await axios.get(`/health`, { timeout: 60000 });
        console.log('Backend server wake ping sent OK');
      } catch (error) {
        console.debug('Backend wake ping failed (ignored):', error.message);
      }
    };
    
    wakeBackend();
  }, []);

  // If user is already logged in, redirect to dashboard
  React.useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const loadingToast = toast.loading('Sending your message...');

    try {
      // EmailJS configuration
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (!serviceId || !templateId || !publicKey) {
        throw new Error('EmailJS configuration missing');
      }

      const result = await emailjs.sendForm(
        serviceId,
        templateId,
        formRef.current,
        publicKey
      );

      toast.dismiss(loadingToast);
      
      if (result.text === 'OK') {
        toast.success('Message sent successfully! We\'ll get back to you soon.', {
          duration: 5000,
          icon: '✉️'
        });
        formRef.current.reset();
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      
      // Check if it's a rate limit error (EmailJS quota exceeded)
      if (error.status === 402 || error.text?.includes('quota') || error.text?.includes('limit')) {
        toast.error(
          'Our monthly email limit has been reached. Please try contacting us via email directly at sumeetdutta040@gmail.com or try again next month.',
          {
            duration: 8000,
            icon: '⚠️'
          }
        );
      } else if (!import.meta.env.VITE_EMAILJS_SERVICE_ID) {
        // Configuration error
        toast.error(
          'Email service is not configured. Please contact us directly at sumeetdutta040@gmail.com',
          { duration: 6000 }
        );
      } else {
        // Generic error
        toast.error(
          'Failed to send message. Please try emailing us directly at sumeetdutta040@gmail.com',
          { duration: 6000 }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="home-page-container">
      {/* Hero Section */}
      <header className="hero">
        <div className="hero-content">
          <h1 className="hero-title">Take Control of Your Finances with AI-Powered Insights</h1>
          <p className="hero-subtitle">Track expenses, analyze spending patterns, and predict future expenses with machine learning</p>
          <div className="hero-buttons">
            <Link to="/login" className="btn btn-large btn-primary">Get Started Free</Link>
            <a href="#features" className="btn btn-large btn-secondary">Learn More</a>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <span className="stat-number">Smart</span>
              <span className="stat-label">AI Predictions</span>
            </div>
            <div className="stat track">
              <span className="stat-number">Easy</span>
              <span className="stat-label">Expense Tracking</span>
            </div>
            <div className="stat">
              <span className="stat-number">Visual</span>
              <span className="stat-label">Analytics</span>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <h2 className="section-title">Powerful Features to Manage Your Money</h2>
          <p className="section-subtitle">Everything you need to track, analyze, and predict your expenses</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3 className="feature-title">Expense Tracking</h3>
              <p className="feature-description">Easily add, edit, and categorize your expenses. Track every penny with intuitive forms and automatic categorization.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3 className="feature-title">AI Predictions</h3>
              <p className="feature-description">Get accurate expense forecasts using machine learning. Our XGBoost model predicts your future spending across all categories.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3 className="feature-title">Visual Analytics</h3>
              <p className="feature-description">Beautiful charts and graphs show your spending patterns. Visualize trends with interactive dashboards powered by Recharts.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">💳</div>
              <h3 className="feature-title">Category Management</h3>
              <p className="feature-description">Organize expenses by categories like Food, Transport, Entertainment, and more. See where your money goes at a glance.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Budget Buckets</h3>
              <p className="feature-description">Plan your monthly spending with category-based budget buckets. Track what's allocated, spent, and remaining for each category.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Secure & Private</h3>
              <p className="feature-description">Protected with JWT auth, bcrypt hashing, Google/Discord OAuth, Cloudflare Turnstile CAPTCHA, and Redis rate limiting.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">Get started in three simple steps</p>
          
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3 className="step-title">Sign Up & Set Budget</h3>
              <p className="step-description">Create your free account and set your monthly budget. Customize your expense categories to match your lifestyle.</p>
            </div>
            
            <div className="step-arrow">→</div>
            
            <div className="step-card">
              <div className="step-number">2</div>
              <h3 className="step-title">Track Your Expenses</h3>
              <p className="step-description">Add your daily expenses with amount, category, and description. View all expenses in an organized list with search and filters.</p>
            </div>
            
            <div className="step-arrow">→</div>
            
            <div className="step-card">
              <div className="step-number">3</div>
              <h3 className="step-title">Get AI Insights</h3>
              <p className="step-description">Access your dashboard to see spending trends, category breakdowns, and AI-powered predictions for future expenses.</p>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll See Section */}
      <section className="what-youll-see-section">
        <div className="container">
          <h2 className="section-title">What You'll Experience</h2>
          <p className="section-subtitle">A comprehensive view of your financial journey</p>
          
          <div className="experience-grid">
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">🏠</span>
                <h3 className="experience-title">Dashboard</h3>
              </div>
              <ul className="experience-list">
                <li>Monthly expense summary with total spending</li>
                <li>Category-wise breakdown with pie charts</li>
                <li>Spending trends over time with line graphs</li>
                <li>Budget vs actual spending comparison</li>
                <li>Quick stats and insights at a glance</li>
              </ul>
            </div>
            
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">➕</span>
                <h3 className="experience-title">Add Expenses</h3>
              </div>
              <ul className="experience-list">
                <li>Simple form to add new expenses</li>
                <li>Select from predefined categories</li>
                <li>Add descriptions and payment methods</li>
                <li>Date picker for past expenses</li>
                <li>Instant feedback with success messages</li>
              </ul>
            </div>
            
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">📋</span>
                <h3 className="experience-title">View Expenses</h3>
              </div>
              <ul className="experience-list">
                <li>Complete list of all your expenses</li>
                <li>Filter by category, date, or payment method</li>
                <li>Search expenses by description</li>
                <li>Edit or delete expenses easily</li>
                <li>Pagination for better navigation</li>
              </ul>
            </div>
            
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">🔮</span>
                <h3 className="experience-title">Predictions</h3>
              </div>
              <ul className="experience-list">
                <li>AI-powered expense forecasts</li>
                <li>Category-specific predictions</li>
                <li>Based on your spending history</li>
                <li>Confidence intervals for predictions</li>
                <li>Help you plan future budgets</li>
              </ul>
            </div>
            
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">�</span>
                <h3 className="experience-title">Budget Buckets</h3>
              </div>
              <ul className="experience-list">
                <li>Plan monthly spending by category</li>
                <li>Track allocated vs spent amounts</li>
                <li>See remaining budget at a glance</li>
                <li>Month-by-month budget planning</li>
                <li>Validation against budget limits</li>
              </ul>
            </div>
            
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">👤</span>
                <h3 className="experience-title">Profile</h3>
              </div>
              <ul className="experience-list">
                <li>Manage your account information</li>
                <li>Update monthly budget settings</li>
                <li>View account statistics</li>
                <li>Customize user type for predictions</li>
                <li>Toggle between light/dark themes</li>
              </ul>
            </div>
            
            <div className="experience-item">
              <div className="experience-header">
                <span className="experience-icon">🎨</span>
                <h3 className="experience-title">Beautiful UI</h3>
              </div>
              <ul className="experience-list">
                <li>Modern, responsive design</li>
                <li>Dark and light theme options</li>
                <li>Smooth animations and transitions</li>
                <li>Mobile-friendly interface</li>
                <li>Intuitive navigation</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="tech-section">
        <div className="container">
          <h2 className="section-title">Built with Modern Technologies</h2>
          <div className="tech-grid">
            <div className="tech-card">
              <h4>Frontend</h4>
              <p>React • Vite • React Router • TailwindCSS • DaisyUI • Recharts • Lucide</p>
            </div>
            <div className="tech-card">
              <h4>Backend</h4>
              <p>Node.js • Express 5 • MongoDB • Mongoose • JWT • Zod • Redis</p>
            </div>
            <div className="tech-card">
              <h4>Security</h4>
              <p>Google/Discord OAuth • Cloudflare Turnstile • Helmet • Rate Limiting</p>
            </div>
            <div className="tech-card">
              <h4>AI/ML</h4>
              <p>Python • FastAPI • XGBoost • Optuna • Scikit-learn • Pandas</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="contact-section">
        <div className="container">
          <h2 className="section-title">Get In Touch</h2>
          <p className="section-subtitle">Have questions? We'd love to hear from you</p>
          
          <div className="contact-content">
            <div className="contact-info">
              <div className="contact-item">
                <div className="contact-icon">📧</div>
                <div className="contact-details">
                  <h4>Email</h4>
                  <a href="mailto:sumeetdutta040@gmail.com">sumeetdutta040@gmail.com</a>
                </div>
              </div>
              
              <div className="contact-item">
                <div className="contact-icon">💬</div>
                <div className="contact-details">
                  <h4>Live Chat</h4>
                  <p>Available Saturday - Sunday, 9AM - 5PM IST</p>
                </div>
              </div>
              
              <div className="contact-item">
                <div className="contact-icon">🐛</div>
                <div className="contact-details">
                  <h4>Report Issues</h4>
                  <a href="https://github.com/SumeetDUTTA/ExpenseKeeper/issues" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
                </div>
              </div>
              
              <div className="contact-item">
                <div className="contact-icon">🌐</div>
                <div className="contact-details">
                  <h4>Social Media</h4>
                  <div className="social-links">
                    <a href="https://github.com/SumeetDUTTA/ExpenseKeeper" target="_blank" rel="noopener noreferrer">GitHub</a>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="contact-form-wrapper">
              <form ref={formRef} className="contact-form" onSubmit={handleContactSubmit}>
                <div className="form-group">
                  <label htmlFor="contact-name">Name</label>
                  <input 
                    type="text" 
                    id="contact-name"
                    name="from_name"
                    placeholder="Your name" 
                    required 
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="contact-email">Email</label>
                  <input 
                    type="email" 
                    id="contact-email"
                    name="from_email"
                    placeholder="your.email@example.com" 
                    required 
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="contact-subject">Subject</label>
                  <input 
                    type="text" 
                    id="contact-subject"
                    name="subject"
                    placeholder="What's this about?" 
                    required 
                    disabled={isSubmitting}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="contact-message">Message</label>
                  <textarea 
                    id="contact-message"
                    name="message"
                    rows="5" 
                    placeholder="Tell us more..." 
                    required
                    disabled={isSubmitting}
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-large btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="get-started" className="cta-section">
        <div className="container">
          <h2 className="cta-title">Ready to Take Control of Your Finances?</h2>
          <p className="cta-subtitle">Join today and start making smarter financial decisions with AI</p>
          <div className="cta-buttons">
            <Link to="/login" className="btn btn-large btn-primary">Create Free Account</Link>
            <Link to="/login" className="btn btn-large btn-secondary">Sign In</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>ExpenseKeeper</h4>
              <p>AI-powered expense management for smarter financial decisions</p>
            </div>
            <div className="footer-section">
              <h4>Features</h4>
              <ul>
                <li><a href="#features">Expense Tracking</a></li>
                <li><a href="#features">AI Predictions</a></li>
                <li><a href="#features">Analytics</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li><Link to="/login">Login</Link></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#contact">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 ExpenseKeeper. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
