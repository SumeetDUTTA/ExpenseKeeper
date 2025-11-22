import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import '../styles/homePage.css';

export default function HomePage() {
  const { token } = useAuth();
  const navigate = useNavigate();

  // If user is already logged in, redirect to dashboard
  React.useEffect(() => {
    if (token) {
      navigate('/dashboard');
    }
  }, [token, navigate]);

  return (
    <div className="home-page-container">
      {/* Hero Section */}
      <header className="hero">
        <nav className="navbar">
          <div className="logo">
            <span className="logo-icon">💰</span>
            <span className="logo-text">Smart Expense Tracker</span>
          </div>
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#get-started" className="nav-link">Get Started</a>
            <Link to="/login" className="btn btn-primary">Login</Link>
          </div>
        </nav>
        
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
            <div className="stat">
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
              <h3 className="feature-title">Budget Planning</h3>
              <p className="feature-description">Set monthly budgets and track your progress. Get alerts when you're approaching your spending limits.</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Secure & Private</h3>
              <p className="feature-description">Your financial data is protected with JWT authentication and encrypted storage. Your privacy is our priority.</p>
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
                <span className="experience-icon">👤</span>
                <h3 className="experience-title">Profile</h3>
              </div>
              <ul className="experience-list">
                <li>Manage your account information</li>
                <li>Update monthly budget settings</li>
                <li>View account statistics</li>
                <li>Customize preferences</li>
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
              <p>React • Vite • TailwindCSS • Recharts</p>
            </div>
            <div className="tech-card">
              <h4>Backend</h4>
              <p>Node.js • Express • MongoDB • JWT</p>
            </div>
            <div className="tech-card">
              <h4>AI/ML</h4>
              <p>Python • XGBoost • FastAPI • Scikit-learn</p>
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
              <h4>Smart Expense Tracker</h4>
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
                <li><a href="#get-started">Get Started</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Smart Expense Tracker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
