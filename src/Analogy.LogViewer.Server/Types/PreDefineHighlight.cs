using System.Drawing;

namespace Analogy.LogViewer.Server.Types
{
    [Serializable]
    public class PreDefineHighlight
    {
        public PreDefinedQueryType PreDefinedQueryType { get; set; }
        public string Text { get; set; }
        public Color Color { get; set; }

        public PreDefineHighlight(PreDefinedQueryType preDefinedQueryType, string text, Color color)
        {
            PreDefinedQueryType = preDefinedQueryType;
            Text = text ?? string.Empty;
            Color = color;
        }
        public override string ToString()
        {
            return $"Highlight: {Text}. Type:{PreDefinedQueryType}. Color:{Color}";
        }
    }
}
