@file:OptIn(androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class)

package expo.modules.t3nativecontrols

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonColors as ComposeButtonColors
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.SplitButtonDefaults
import androidx.compose.material3.SplitButtonLayout
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ExpoUIView
import expo.modules.ui.GenericEventPayload1
import expo.modules.ui.button.ButtonColors
import expo.modules.ui.compose

@OptimizedRecord
class SplitButtonAction : Record {
  @Field val id: String = ""

  @Field val title: String = ""

  @Field val selected: Boolean = false

  @Field val enabled: Boolean = true
}

@OptimizedComposeProps
data class SplitButtonProps(
  val label: String = "",
  val accessibilityLabel: String = "",
  val enabled: Boolean = true,
  val loading: Boolean = false,
  val menuTitle: String = "",
  val actions: List<SplitButtonAction> = emptyList(),
  val fontSize: Float = 14f,
  val lineHeight: Float = 19f,
  val menuFontSize: Float = 16f,
  val menuLineHeight: Float = 23f,
  val scale: Float = 1f,
  val colors: ButtonColors = ButtonColors()
) : ComposeProps

class T3SplitButtonModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("T3SplitButton")
    ExpoUIView<SplitButtonProps>("SplitButton") {
      val onButtonPressed by Event<Unit>()
      val onActionSelected by Event<GenericEventPayload1<String>>()
      Content { props ->
        splitButtonContent(props, {
          onButtonPressed(Unit)
        }, { onActionSelected(GenericEventPayload1(it)) })
      }
    }
  }
}

@Composable
private fun splitButtonContent(
  props: SplitButtonProps,
  onClick: () -> Unit,
  onSelect: (String) -> Unit
) {
  val colors = ButtonDefaults.buttonColors(
    containerColor = props.colors.containerColor.compose,
    contentColor = props.colors.contentColor.compose,
    disabledContainerColor = props.colors.disabledContainerColor.compose,
    disabledContentColor = props.colors.disabledContentColor.compose
  )
  val enabled = props.enabled && !props.loading
  val height = (48 * props.scale).dp
  BoxWithConstraints {
    val trailingWidth = (48 * props.scale).dp
    val leadingWidth = if (props.actions.isEmpty()) {
      maxWidth
    } else {
      (maxWidth - trailingWidth - SplitButtonDefaults.Spacing).coerceAtLeast(0.dp)
    }
    val leadingModifier = Modifier.width(leadingWidth).heightIn(min = height)
      .semantics { contentDescription = props.accessibilityLabel }
    if (props.actions.isEmpty()) {
      Button(onClick = onClick, enabled = enabled, colors = colors, modifier = leadingModifier) {
        splitButtonLabel(props)
      }
    } else {
      SplitButtonLayout(
        leadingButton = {
          SplitButtonDefaults.LeadingButton(
            onClick = onClick,
            enabled = enabled,
            colors = colors,
            modifier = leadingModifier
          ) { splitButtonLabel(props) }
        },
        trailingButton = { splitButtonMenu(props, colors, onSelect) }
      )
    }
  }
}

@Composable
private fun splitButtonLabel(props: SplitButtonProps) {
  if (props.loading) {
    LoadingIndicator(
      modifier = Modifier.size((18 * props.scale).dp),
      color = props.colors.disabledContentColor.compose
    )
    Spacer(Modifier.width((8 * props.scale).dp))
  }
  Text(
    props.label,
    fontSize = props.fontSize.sp,
    lineHeight = props.lineHeight.sp,
    fontWeight = FontWeight.Medium
  )
}

@Composable
private fun splitButtonMenu(
  props: SplitButtonProps,
  colors: ComposeButtonColors,
  onSelect: (String) -> Unit
) {
  val enabled = props.actions.any { it.enabled }
  var expanded by remember(enabled) { mutableStateOf(false) }
  Box(propagateMinConstraints = true) {
    SplitButtonDefaults.TrailingButton(
      checked = expanded,
      onCheckedChange = { expanded = it },
      enabled = enabled,
      colors = if (props.enabled && !props.loading) {
        colors
      } else {
        colors.copy(
          containerColor = colors.disabledContainerColor,
          contentColor = colors.disabledContentColor
        )
      },
      modifier = Modifier.width((48 * props.scale).dp).heightIn(min = (48 * props.scale).dp)
        .semantics { contentDescription = props.menuTitle }
    ) {
      Icon(
        painter = painterResource(R.drawable.t3_chevron_down),
        contentDescription = null,
        modifier = Modifier.size((24 * props.scale).dp)
          .graphicsLayer { rotationZ = if (expanded) 180f else 0f }
      )
    }
    DropdownMenu(
      expanded = expanded,
      onDismissRequest = { expanded = false },
      modifier = Modifier.width((250 * props.scale).dp)
    ) {
      props.actions.forEach { action ->
        DropdownMenuItem(
          text = {
            Text(
              action.title,
              fontSize = props.menuFontSize.sp,
              lineHeight = props.menuLineHeight.sp
            )
          },
          enabled = action.enabled,
          modifier = Modifier.heightIn(min = (48 * props.scale).dp)
            .semantics { selected = action.selected },
          trailingIcon = {
            if (action.selected) {
              Icon(
                painterResource(R.drawable.t3_check),
                contentDescription = null
              )
            }
          },
          onClick = {
            expanded = false
            onSelect(action.id)
          }
        )
      }
    }
  }
}
