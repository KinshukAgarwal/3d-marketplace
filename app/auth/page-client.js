// app/auth/page-client.js
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '../../lib/auth'

export default function AuthClient() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const router = useRouter()
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      if (isLogin) {
        const { error } = await signIn(email, password)
        if (error) throw error
      } else {
        const { error } = await signUp(email, password, fullName)
        if (error) throw error
      }
      
      router.push('/marketplace')
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div>
      <div className="tabs">
        <button 
          className={isLogin ? 'active' : ''} 
          onClick={() => setIsLogin(true)}
        >
          Login
        </button>
        <button 
          className={!isLogin ? 'active' : ''} 
          onClick={() => setIsLogin(false)}
        >
          Sign Up
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)} 
              required={!isLogin}
            />
          </div>
        )}
        
        <div className="form-group">
          <label>Email</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required
          />
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>
    </div>
  )
}
