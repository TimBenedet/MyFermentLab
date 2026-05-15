import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, ArrowLeft, Plus, Upload } from 'lucide-react'
import { useBrewing, useBrewingActions } from '../context/BrewingContext'
import { useConnection } from '../context/ConnectionContext'
import { fetchRecipes, createBackendRecipe, deleteBackendRecipe } from '../api/recipes'
import { RecipeCard } from '../components/recipe/RecipeCard'
import { parseBeerXml } from '../utils/parseBeerXml'
import type { Recipe } from '../types/brewing'

export function RecipesPage() {
  const navigate = useNavigate()
  const { state } = useBrewing()
  const { importRecipes, deleteRecipe } = useBrewingActions()
  const { mode } = useConnection()
  const isLive = mode === 'live'
  const [loaded, setLoaded] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addRecipe } = useBrewingActions()

  useEffect(() => {
    if (!isLive || loaded) return
    fetchRecipes()
      .then(recipes => {
        if (recipes.length > 0) importRecipes(recipes)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [isLive, loaded, importRecipes])

  const recipes = [...state.recipes].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))

  const handleLaunch = (recipe: Recipe) => {
    navigate(`/create?recipeId=${recipe.id}`)
  }

  const handleEdit = (recipe: Recipe) => {
    navigate(`/create?mode=recipe&editId=${recipe.id}`)
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const text = await file.text()
      const recipes = parseBeerXml(text)
      for (const recipe of recipes) {
        if (isLive) {
          const saved = await createBackendRecipe(recipe)
          addRecipe({ ...recipe, id: saved.id })
        } else {
          addRecipe(recipe)
        }
      }
      if (recipes.length === 1) {
        navigate(`/create?mode=recipe&editId=${recipes[0].id}`)
      }
    } catch (err) {
      console.error('BeerXML import failed:', err)
    } finally {
      setImporting(false)
    }
  }

  const handleDelete = async (recipe: Recipe) => {
    if (isLive) {
      try { await deleteBackendRecipe(recipe.id) } catch { return }
    }
    deleteRecipe(recipe.id)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="scada-btn-neutral p-2">
          <ArrowLeft size={14} />
        </button>
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-scada-text-secondary" />
          <span className="scada-label">Recettes</span>
        </div>
        <span className="text-[10px] text-scada-text-muted">
          {recipes.length} recette{recipes.length > 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.beerxml"
          className="hidden"
          onChange={handleImportFile}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg font-medium bg-scada-card text-scada-text-secondary border border-scada-border hover:text-white hover:border-scada-accent/50 transition-colors"
        >
          <Upload size={12} />
          {importing ? 'Import...' : 'Importer BeerXML'}
        </button>
        <button
          onClick={() => navigate('/create?mode=recipe')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg font-medium bg-scada-accent/15 text-scada-accent border border-scada-accent/30 hover:bg-scada-accent/25 transition-colors"
        >
          <Plus size={12} />
          Nouvelle recette
        </button>
      </div>

      {recipes.length === 0 ? (
        <div className="scada-card flex flex-col items-center justify-center py-12">
          <BookOpen size={32} className="text-scada-text-muted mb-3" />
          <p className="text-sm text-scada-text-muted">Aucune recette sauvegardee</p>
          <p className="text-[10px] text-scada-text-muted mt-1">
            Creez une recette pour la retrouver dans votre bibliotheque
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onLaunch={handleLaunch}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
