package expo.modules.t3nativecontrols

import android.content.Context
import android.view.ViewGroup
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalWideNavigationRail
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.WideNavigationRailDefaults
import androidx.compose.material3.WideNavigationRailItem
import androidx.compose.material3.WideNavigationRailItemDefaults
import androidx.compose.material3.WideNavigationRailValue
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.rememberWideNavigationRailState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import kotlinx.coroutines.launch

class T3WorkspaceNavigationModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("T3WorkspaceNavigation")
    View(T3WorkspaceNavigationView::class) {
      Prop("newEnabled") { view: T3WorkspaceNavigationView, value: Boolean ->
        view.newEnabled = value
      }
      Prop("safeAreaTop") { view: T3WorkspaceNavigationView, value: Float ->
        view.safeAreaTop = value
      }
      Prop("headerHeight") { view: T3WorkspaceNavigationView, value: Float ->
        view.headerHeight = value
      }
      Prop("actionColor") { view: T3WorkspaceNavigationView, value: Int ->
        view.actionColor = value
      }
      Prop("actionContentColor") { view: T3WorkspaceNavigationView, value: Int ->
        view.actionContentColor = value
      }
      Prop("selectedTab") { view: T3WorkspaceNavigationView, value: String ->
        view.selectedTab = value
      }
      Prop("rail") { view: T3WorkspaceNavigationView, value: Boolean -> view.rail = value }
      Prop("dark") { view: T3WorkspaceNavigationView, value: Boolean -> view.dark = value }
      Prop("textScale") { view: T3WorkspaceNavigationView, value: Float -> view.textScale = value }
      Prop("containerColor") { view: T3WorkspaceNavigationView, value: Int ->
        view.containerColor = value
      }
      Prop("selectedColor") { view: T3WorkspaceNavigationView, value: Int ->
        view.selectedColor = value
      }
      Prop("indicatorColor") { view: T3WorkspaceNavigationView, value: Int ->
        view.indicatorColor = value
      }
      Prop("unselectedColor") { view: T3WorkspaceNavigationView, value: Int ->
        view.unselectedColor = value
      }
      Events("onTabSelected", "onNewThread")
    }
  }
}

/** One Material3 selection surface moves from below the list to its leading edge. */
@OptIn(ExperimentalMaterial3ExpressiveApi::class)
class T3WorkspaceNavigationView(
  context: Context,
  appContext: AppContext
) : ExpoView(context, appContext) {
  // Compose must remeasure native children when Yoga resizes the folded window.
  override val shouldUseAndroidLayout = true

  private val onTabSelected by EventDispatcher()
  private val onNewThread by EventDispatcher()
  var newEnabled by mutableStateOf(false)
  var safeAreaTop by mutableStateOf(0f)
  var headerHeight by mutableStateOf(56f)
  var actionColor by mutableStateOf(0)
  var actionContentColor by mutableStateOf(0)
  var selectedTab by mutableStateOf("threads")
  var rail by mutableStateOf(false)
  var dark by mutableStateOf(false)
  var textScale by mutableStateOf(1f)
  var containerColor by mutableStateOf(0)
  var selectedColor by mutableStateOf(0)
  var indicatorColor by mutableStateOf(0)
  var unselectedColor by mutableStateOf(0)

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    // Fabric measures the replacement bar before attaching it on a fold.
    // Compose needs an attached window to obtain its lifecycle recomposer.
    if (!isAttachedToWindow) {
      setMeasuredDimension(
        MeasureSpec.getSize(widthMeasureSpec),
        MeasureSpec.getSize(heightMeasureSpec)
      )
      return
    }
    super.onMeasure(widthMeasureSpec, heightMeasureSpec)
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    if (isAttachedToWindow) super.onLayout(changed, left, top, right, bottom)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    requestLayout()
  }

  init {
    addView(
      ComposeView(context).apply {
        setViewCompositionStrategy(
          ViewCompositionStrategy.DisposeOnDetachedFromWindowOrReleasedFromPool
        )
        setContent {
          MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme()) {
            val tabs = listOf("threads", "pullRequests", "settings")
            if (rail) {
              val railState = rememberWideNavigationRailState()
              val scope = rememberCoroutineScope()
              // Mirrors ModalWideNavigationRail's internal modalExpanded threshold, so labels and
              // FABs expand on the frame the modal container starts widening, not before. Closing
              // starts at once so they finish collapsing before the modal's window goes away.
              val railOpening = railState.targetValue == WideNavigationRailValue.Expanded
              val modalProgress by animateFloatAsState(
                targetValue = if (railOpening) 1f else 0f,
                animationSpec = MaterialTheme.motionScheme.defaultEffectsSpec(),
              )
              val expandingRail = railOpening && modalProgress >= 0.3f
              // The header composes in both the inline rail and the modal's dialog window; only
              // the modal copy expands, so the inline rail under the scrim never reflows.
              val hostView = LocalView.current
              ModalWideNavigationRail(
                modifier = Modifier.fillMaxHeight(),
                expandedHeaderTopPadding = safeAreaTop.dp,
                state = railState,
                contentPadding = PaddingValues(bottom = 12.dp),
                header = {
                  val expandedRail = expandingRail && LocalView.current !== hostView
                  // The extended FAB fades its text slower than it shrinks; keep it off the icon.
                  val fabTextAlpha by animateFloatAsState(
                    targetValue = if (expandedRail) 1f else 0f,
                    animationSpec = MaterialTheme.motionScheme.fastEffectsSpec(),
                  )
                  Column(
                    modifier = Modifier.padding(start = 20.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                  ) {
                    // Centered in a row as tall as the list toolbar, so the menu lines up
                    // with its actions.
                    Box(
                      Modifier.height(headerHeight.dp),
                      contentAlignment = Alignment.CenterStart
                    ) {
                      IconButton(
                        onClick = { scope.launch { railState.toggle() } },
                        modifier = Modifier.padding(start = 4.dp).semantics {
                          contentDescription = if (expandedRail) {
                            "Collapse navigation rail"
                          } else {
                            "Expand navigation rail"
                          }
                        },
                      ) {
                        Icon(
                          painterResource(R.drawable.t3_menu),
                          contentDescription = null,
                          tint = Color(unselectedColor)
                        )
                      }
                    }
                    ExtendedFloatingActionButton(
                      onClick = {
                        if (newEnabled) {
                          scope.launch {
                            railState.collapse()
                            onNewThread(emptyMap<String, Any>())
                          }
                        }
                      },
                      expanded = expandedRail,
                      icon = {
                        Icon(painterResource(R.drawable.t3_new), contentDescription = null)
                      },
                      text = { Text("New thread", Modifier.alpha(fabTextAlpha)) },
                      modifier = Modifier.height(
                        56.dp
                      ).alpha(if (newEnabled) 1f else 0.4f).semantics {
                        contentDescription =
                          "New thread"
                        if (!newEnabled) disabled()
                      },
                      containerColor = Color(actionColor),
                      contentColor = Color(actionContentColor),
                    )
                  }
                },
                colors = WideNavigationRailDefaults.colors(
                  containerColor = Color(containerColor),
                  contentColor = Color(unselectedColor),
                  modalContainerColor = Color(containerColor),
                  modalContentColor = Color(unselectedColor)
                ),
                windowInsets = WindowInsets(0),
                // Menu and New thread stay top-aligned; destinations center like Material's rail.
                arrangement = Arrangement.Center,
              ) {
                val expandedRail = expandingRail && LocalView.current !== hostView
                // Mirrors WideNavigationRailItem's icon-position spring. Its label is invisible at
                // the midpoint, so the text and size swap there, and the label stays transparent
                // while it slides across the icon.
                val labelProgress by animateFloatAsState(
                  targetValue = if (expandedRail) 1f else 0f,
                  animationSpec = MaterialTheme.motionScheme.defaultSpatialSpec(),
                )
                val expandedLabel = labelProgress >= 0.5f
                val labelAlpha = if (expandedLabel) {
                  ((labelProgress - 0.5f) / 0.35f).coerceIn(
                    0f,
                    1f
                  )
                } else {
                  1f
                }
                tabs.forEach { tab ->
                  WideNavigationRailItem(
                    selected = selectedTab == tab,
                    onClick = {
                      scope.launch {
                        railState.collapse()
                        onTabSelected(mapOf("tab" to tab))
                      }
                    },
                    railExpanded = expandedRail,
                    icon = { tabIcon(tab) },
                    label = {
                      Text(
                        if (tab == "pullRequests" &&
                          expandedLabel
                        ) {
                          "Pull Requests"
                        } else {
                          tabTitle(tab)
                        },
                        Modifier.alpha(labelAlpha),
                        fontSize = ((if (expandedLabel) 14 else 12) * textScale).sp,
                      )
                    },
                    colors = WideNavigationRailItemDefaults.colors(
                      selectedIconColor = Color(selectedColor),
                      selectedTextColor = Color(selectedColor),
                      selectedIndicatorColor = Color(indicatorColor),
                      unselectedIconColor = Color(unselectedColor),
                      unselectedTextColor = Color(unselectedColor),
                    ),
                  )
                }
              }
            } else {
              NavigationBar(
                modifier = Modifier.fillMaxSize(),
                containerColor = Color(containerColor),
                tonalElevation = androidx.compose.ui.unit.Dp(0f),
                windowInsets = WindowInsets(0),
              ) {
                tabs.forEach { tab ->
                  NavigationBarItem(
                    selected = selectedTab == tab,
                    onClick = { onTabSelected(mapOf("tab" to tab)) },
                    icon = { tabIcon(tab) },
                    label = {
                      val title = tabTitle(tab)
                      Text(title, fontSize = (12 * textScale).sp)
                    },
                    colors = NavigationBarItemDefaults.colors(
                      selectedIconColor = Color(selectedColor),
                      selectedTextColor = Color(selectedColor),
                      indicatorColor = Color(indicatorColor),
                      unselectedIconColor = Color(unselectedColor),
                      unselectedTextColor = Color(unselectedColor),
                    ),
                  )
                }
              }
            }
          }
        }
      },
      LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
    )
  }

  private fun tabTitle(tab: String) = when (tab) {
    "threads" -> "Chats"
    "pullRequests" -> "PRs"
    else -> "Settings"
  }

  @Composable
  private fun tabIcon(tab: String) {
    val drawable = when (tab) {
      "threads" -> R.drawable.t3_chats
      "pullRequests" -> R.drawable.t3_pull_requests
      else -> R.drawable.t3_settings
    }
    // Every destination shows a label, which names it for accessibility.
    Icon(
      painter = painterResource(drawable),
      contentDescription = null,
    )
  }
}
