import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AvisoConexion from './components/AvisoConexion.jsx'
import { instalarFetchConSesion } from './lib/sesion.js'
import { arrancarCola } from './lib/colaOffline.js'

// Todas las llamadas /api llevan el token de sesión (y un 401 devuelve al login).
instalarFetchConSesion()

// Lo que se guardó sin conexión se sube en cuanto vuelve la red.
arrancarCola()

// Si algo se rompe en pantalla, que no quede una página negra: se muestra el
// error y un botón para recargar.
class CortaErrores extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Error en pantalla:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#0f172a' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Algo se ha roto en pantalla</h1>
          <pre style={{ margin: '1rem 0', whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
            {String(this.state.error?.message ?? this.state.error)}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#0369a1', color: '#fff', border: 0 }}
          >
            Recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CortaErrores>
      <App />
      <AvisoConexion />
    </CortaErrores>
  </StrictMode>,
)
